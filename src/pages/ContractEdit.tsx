import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Search, Calendar, User, DollarSign, X } from 'lucide-react';
import { loadBillboards } from '@/services/billboardService';
import type { Billboard } from '@/types';
import { addBillboardsToContract, getContractWithBillboards, removeBillboardFromContract, updateContract } from '@/services/contractService';
import { useLocation, useNavigate } from 'react-router-dom';

export default function ContractEdit() {
  const navigate = useNavigate();
  const location = useLocation();

  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractNumber, setContractNumber] = useState<string>('');

  // selection
  const [selected, setSelected] = useState<string[]>([]);

  // filters
  const [q, setQ] = useState('');
  const [city, setCity] = useState<string>('all');
  const [size, setSize] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');

  // form fields
  const [customerName, setCustomerName] = useState('');
  const [adType, setAdType] = useState('');
  const [pricingCategory, setPricingCategory] = useState<string>('عادي');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rentCost, setRentCost] = useState<number>(0);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cn = params.get('contract');
    if (cn) setContractNumber(String(cn));
  }, [location.search]);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadBillboards();
        setBillboards(data);
      } catch (e) {
        console.error(e);
        toast.error('فشل تحميل اللوحات');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!contractNumber) return;
      try {
        const c = await getContractWithBillboards(contractNumber);
        setCustomerName(c.customer_name || c['Customer Name'] || '');
        setAdType(c.ad_type || c['Ad Type'] || '');
        setStartDate(c.start_date || c['Contract Date'] || '');
        setEndDate(c.end_date || c['End Date'] || '');
        setRentCost(typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] || 0));
        setSelected((c.billboards || []).map((b: any) => String(b.ID)));
      } catch (e) {
        console.error(e);
        toast.error('تعذر تحميل العقد');
      }
    })();
  }, [contractNumber]);

  const cities = useMemo(() => Array.from(new Set(billboards.map(b => b.city || b.City))).filter(Boolean) as string[], [billboards]);
  const sizes = useMemo(() => Array.from(new Set(billboards.map(b => b.size || b.Size))).filter(Boolean) as string[], [billboards]);

  const filtered = useMemo(() => {
    return billboards.filter((b) => {
      const text = (b.name || b.Billboard_Name || '').toLowerCase();
      const loc = (b.location || b.Nearest_Landmark || '').toLowerCase();
      const c = (b.city || b.City || '').toString();
      const s = (b.size || b.Size || '').toString();
      const st = (b.status || b.Status || '').toString();
      const matchesQ = !q || text.includes(q.toLowerCase()) || loc.includes(q.toLowerCase());
      const matchesCity = city === 'all' || c === city;
      const matchesSize = size === 'all' || s === size;
      // allow selecting items already in this contract; otherwise prefer available only when status filter is 'available'
      const isInContract = selected.includes(String(b.ID));
      const matchesStatus = status === 'all' || (status === 'available' ? (st === 'available' || (!b.contractNumber && !b.Contract_Number) || isInContract) : true);
      return matchesQ && matchesCity && matchesSize && matchesStatus;
    });
  }, [billboards, q, city, size, status, selected]);

  const toggleSelect = (b: Billboard) => {
    const id = String(b.ID);
    setSelected((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const removeSelected = (id: string) => setSelected((prev) => prev.filter(x => x !== id));

  const save = async () => {
    try {
      if (!contractNumber) return;
      // fetch current to compare (could also track previous state separately)
      const c = await getContractWithBillboards(contractNumber);
      const current: string[] = (c.billboards || []).map((b: any) => String(b.ID));
      const toAdd = selected.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !selected.includes(id));

      if (toAdd.length > 0) {
        await addBillboardsToContract(contractNumber, toAdd, {
          start_date: startDate,
          end_date: endDate,
          customer_name: customerName,
        });
      }
      for (const id of toRemove) {
        await removeBillboardFromContract(contractNumber, id);
      }

      await updateContract(contractNumber, {
        'Customer Name': customerName,
        'Ad Type': adType,
        'Contract Date': startDate,
        'End Date': endDate,
        'Total Rent': rentCost,
      });

      toast.success('تم حفظ التعديلات');
      navigate('/admin/contracts');
    } catch (e) {
      console.error(e);
      toast.error('فشل حفظ التعديلات');
    }
  };

  return (
    <div className="container mx-auto px-4 py-6" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">تعديل عقد {contractNumber && `#${contractNumber}`}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/contracts')}>عودة</Button>
          <Button onClick={save}>حفظ</Button>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* main area */}
        <div className="flex-1 space-y-6">
          {/* selected on top */}
          <Card>
            <CardHeader>
              <CardTitle>اللوحات المرتبطة ({selected.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {selected.length === 0 ? (
                <p className="text-muted-foreground">لا توجد لوحات</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {billboards.filter(b => selected.includes(String(b.ID))).map((b) => (
                    <Card key={b.ID} className="overflow-hidden">
                      <CardContent className="p-0">
                        {b.image && (
                          <img src={b.image} alt={b.name || b.Billboard_Name} className="w-full h-36 object-cover" />
                        )}
                        <div className="p-3 flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{b.name || b.Billboard_Name}</div>
                            <div className="text-xs text-muted-foreground">{b.location || b.Nearest_Landmark}</div>
                            <div className="text-xs">الحجم: {b.size || b.Size} • {b.city || b.City}</div>
                          </div>
                          <Button size="sm" variant="destructive" onClick={() => removeSelected(String(b.ID))}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 relative min-w-[220px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="بحث عن لوحة" value={q} onChange={(e) => setQ(e.target.value)} className="pr-9" />
                </div>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="المدينة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المدن</SelectItem>
                    {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="المقاس" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المقاسات</SelectItem>
                    {sizes.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="available">المتاحة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* grid below */}
          <Card>
            <CardHeader>
              <CardTitle>كل اللوحات</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-10 text-center">جاري التحميل...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((b) => {
                    const isSelected = selected.includes(String(b.ID));
                    const st = (b.status || b.Status || '').toString();
                    const notAvailable = st === 'rented' || (!!b.contractNumber || !!b.Contract_Number);
                    const disabled = notAvailable && !isSelected;
                    return (
                      <Card key={b.ID} className={`overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
                        <CardContent className="p-0">
                          {b.image && (
                            <img src={b.image} alt={b.name || b.Billboard_Name} className="w-full h-40 object-cover" />
                          )}
                          <div className="p-3 space-y-1">
                            <div className="font-semibold">{b.name || b.Billboard_Name}</div>
                            <div className="text-xs text-muted-foreground">{b.location || b.Nearest_Landmark}</div>
                            <div className="text-xs">{b.city || b.City} • {b.size || b.Size}</div>
                            <div className="text-sm font-medium">{(Number(b.price) || 0).toLocaleString('ar-LY')} د.ل / شهر</div>
                            <div className="pt-2">
                              <Button size="sm" variant={isSelected ? 'destructive' : 'outline'} onClick={() => toggleSelect(b)} disabled={disabled}>
                                {isSelected ? 'إزالة' : 'إضافة'}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* sidebar */}
        <div className="w-full lg:w-[360px] space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> بيانات الزبون</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm">اسم الزبون</label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">نوع الإعلان</label>
                <Input value={adType} onChange={(e) => setAdType(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">فئة السعر</label>
                <Select value={pricingCategory} onValueChange={setPricingCategory}>
                  <SelectTrigger><SelectValue placeholder="الفئة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="عادي">عادي</SelectItem>
                    <SelectItem value="شركات">شركات</SelectItem>
                    <SelectItem value="مسوق">مسوق</SelectItem>
                    <SelectItem value="المدينة">المدينة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> المدة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm">تاريخ البداية</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">تاريخ النهاية</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> التكلفة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input type="number" value={rentCost} onChange={(e) => setRentCost(Number(e.target.value))} placeholder="تكلفة العقد" />
              <Button className="w-full" onClick={save}>حفظ التعديلات</Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/contracts')}>إلغاء</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
