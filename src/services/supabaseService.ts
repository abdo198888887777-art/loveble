import { supabase } from '@/integrations/supabase/client';
import { Billboard, Contract, Pricing } from '@/types';
import { loadBillboards as loadBillboardsNormalized } from '@/services/billboardService';

// جلب جميع اللوحات
export const fetchAllBillboards = async (): Promise<Billboard[]> => {
  try {
    const { data, error } = await supabase
      .from('billboards')
      .select('*');

    if (!error && Array.isArray(data) && data.length > 0) {
      // إزالة التكرار وتحديد الحالة
      const uniqueBillboards = new Map<number, any>();
      (data || []).forEach((billboard: any) => {
        if (!uniqueBillboards.has(billboard.ID)) {
          uniqueBillboards.set(billboard.ID, {
            ...billboard,
            Status: billboard.Contract_Number ? 'مؤجر' : 'متاح'
          });
        }
      });
      const processedData = Array.from(uniqueBillboards.values());
      console.log('Fetched unique billboards:', processedData.length);
      return processedData as any;
    }

    console.warn('Supabase billboards unavailable, falling back. Details:', (error as any)?.message || 'no data');
  } catch (error) {
    console.warn('Supabase fetchAllBillboards failed, will fallback:', (error as any)?.message || JSON.stringify(error));
  }

  // Fallback: use normalized loader (Google Sheets/local defaults), then map to legacy shape used by pages
  try {
    const normalized = await loadBillboardsNormalized();
    const mapped: any[] = normalized.map((b, i) => ({
      ID: Number(b.id) || i + 1,
      Billboard_Name: b.name,
      City: b.city || '',
      District: (b as any).district || b.district || '',
      Municipality: (b as any).municipality || b.municipality || '',
      Size: (b as any).size || b.size || '',
      Status: b.status === 'available' ? 'متاح' : b.status === 'rented' ? 'مؤجر' : 'صيانة',
      Price: String((b as any).price ?? ''),
      Level: (b as any).level ?? '',
      Image_URL: (b as any).image ?? '',
      GPS_Coordinates: typeof (b as any).coordinates === 'string' ? (b as any).coordinates : '',
      GPS_Link: (b as any).coordinates ? (typeof (b as any).coordinates === 'string' ? `https://www.google.com/maps?q=${(b as any).coordinates}` : '') : '',
      Nearest_Landmark: (b as any).location ?? '',
      Faces_Count: (b as any).faces ?? '',
      Contract_Number: (b as any).contractNumber ?? '',
      Customer_Name: (b as any).clientName ?? '',
      Rent_Start_Date: '',
      Rent_End_Date: (b as any).expiryDate ?? '',
      Days_Count: (b as any).remainingDays ?? '',
      Review: '',
      Category_Level: '',
      Ad_Type: (b as any).adType ?? '',
      Order_Size: undefined,
      '@IMAGE': undefined,
      GPS_Link_Click: undefined,
      'المقاس مع الدغاية': undefined,
    }));
    console.log('Fallback mapped billboards:', mapped.length);
    return mapped as any;
  } catch (e) {
    console.error('Fallback loaders failed, returning empty list:', (e as any)?.message || e);
    return [];
  }
};

// جلب العقود مع دعم جدولين محتملين واستخراج أخطاء أوضح
export const fetchContracts = async (): Promise<Contract[]> => {
  try {
    // المحاولة 1: جدول Contract (يدعم Contract_Number أو "Contract Number")
    let data: any[] | null = null; let error: any = null;
    try {
      const q1 = await supabase.from('Contract').select('*').order('Contract_Number', { ascending: false });
      data = q1.data as any[] | null; error = q1.error;
    } catch (e) { error = e; }
    if (error || !Array.isArray(data)) {
      const q2 = await supabase.from('Contract').select('*').order('"Contract Number"', { ascending: false });
      data = q2.data as any[] | null; error = q2.error;
    }

    if (!error && Array.isArray(data)) {
      console.log('Fetched contracts (Contract):', data.length);
      // normalize key
      const normalized = (data as any[]).map((c: any) => ({
        ...c,
        Contract_Number: c.Contract_Number ?? c['Contract Number'] ?? c.id ?? c.ID,
        'Contract Number': c['Contract Number'] ?? c.Contract_Number ?? c.id ?? c.ID,
      })) as Contract[];
      return normalized as any;
    }

    console.warn('Contract table not available or errored. Details:', (error as any)?.message || JSON.stringify(error));
    return [];
  } catch (error: any) {
    console.warn('Error in fetchContracts, returning empty list:', error?.message || JSON.stringify(error));
    return [];
  }
};

// جلب أسعار اللوحات
export const fetchPricing = async (): Promise<Pricing[]> => {
  try {
    const { data, error } = await supabase
      .from('pricing')
      .select('*');

    if (error) {
      console.error('Error fetching pricing:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchPricing:', error);
    throw error;
  }
};

// إنشاء عقد جديد
export async function createContract(contractData: any) {
  const { data, error } = await supabase
    .from('Contract')
    .insert({
      'Customer Name': contractData.customer_name,
      'Contract Date': contractData.start_date,
      'End Date': contractData.end_date,
      'Total Rent': contractData.rent_cost || 0,
      'Ad Type': contractData.ad_type || '',
      'Contract Number': Date.now().toString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// تحديث حالة اللوحة
export const updateBillboardStatus = async (
  billboardId: number, 
  updates: Partial<Billboard>
): Promise<Billboard> => {
  try {
    const { data, error } = await supabase
      .from('billboards')
      .update(updates)
      .eq('ID', billboardId)
      .select()
      .single();

    if (error) {
      console.error('Error updating billboard:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateBillboardStatus:', error);
    throw error;
  }
};

// جلب الإحصائيات
export const fetchDashboardStats = async () => {
  try {
    const [billboards, contracts] = await Promise.all([
      fetchAllBillboards(),
      fetchContracts()
    ]);

    const availableBillboards = billboards.filter(b =>
      b.Status === 'متاح' || b.Status === 'available' || !b.Contract_Number
    );

    const rentedBillboards = billboards.filter(b =>
      b.Status === 'مؤجر' || b.Status === 'rented' || b.Contract_Number
    );

    const nearExpiry = rentedBillboards.filter(billboard => {
      if (!billboard.Rent_End_Date) return false;
      try {
        const endDate = new Date(billboard.Rent_End_Date);
        const today = new Date();
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 20 && diffDays > 0;
      } catch {
        return false;
      }
    });

    const totalRevenue = contracts.reduce((sum, contract) => {
      const total = parseFloat(contract['Total Rent']?.toString() || '0');
      return sum + (isNaN(total) ? 0 : total);
    }, 0);

    return {
      totalBillboards: billboards.length,
      availableBillboards: availableBillboards.length,
      rentedBillboards: rentedBillboards.length,
      nearExpiryBillboards: nearExpiry.length,
      totalContracts: contracts.length,
      totalRevenue,
      availableBillboardsList: availableBillboards,
      nearExpiryBillboardsList: nearExpiry
    };
  } catch (error: any) {
    console.warn('Error fetching dashboard stats, returning defaults:', error?.message || JSON.stringify(error));
    return {
      totalBillboards: 0,
      availableBillboards: 0,
      rentedBillboards: 0,
      nearExpiryBillboards: 0,
      totalContracts: 0,
      totalRevenue: 0,
      availableBillboardsList: [],
      nearExpiryBillboardsList: []
    };
  }
};
