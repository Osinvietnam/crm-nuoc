# AUDIT: Hành Trình Khách Hàng — Liên Kết & Ràng Buộc
**Ngày audit**: 2026-04-16  
**Phạm vi**: Toàn bộ pipeline khách hàng (9 stage), tự động hóa, ràng buộc dữ liệu, FK/constraint  
**Tổng vấn đề tìm được**: 38 vấn đề (8🔴 Critical, 12🟠 High, 13🟡 Medium, 11🟢 Low)

---

## 📊 Tóm Tắt Executive

Pipeline khách hàng hiện tại **KHÔNG CÓ** hệ thống ràng buộc thứ tự stage, không kiểm tra prerequisite (thanh toán, quote chấp nhận, task hoàn thành) trước khi chuyển stage. Sales có thể nhảy từ "Lead mới" thẳng sang "Bảo trì" bỏ qua 7 stage; HĐ được tạo mà không link KH; BG được chấp nhận nhưng không tạo được HĐ; task checklist chỉ trang trí không bắt buộc.

**Ảnh hưởng kinh doanh**:
- ❌ KPI track sai (doanh số, hợp đồng, khách hàng mới)
- ❌ Commission không tính được (HĐ không link KH)
- ❌ Doanh thu 3 đợt thanh toán mất liên kết (payment không link HĐ thật)
- ❌ Quyết định business dựa vào sai dữ liệu → chiến lược thất bại
- ❌ Audit lịch sử không đáng tin (pipeline bắt nhảy tùy ý, không trace)

---

## 🔴 CRITICAL (8 vấn đề) — Gãy Logic / Mất Dữ Liệu / Bypass Quy Trình

### C1. Pipeline KH Có Thể Nhảy Tùy Ý — Không Có Bất Kỳ Ràng Buộc Thứ Tự

**File**:  
- `app/api/lark/customers/[id]/route.ts:85-97` (PATCH whitelist chỉ field, không validate value)
- `app/dashboard/customers/[id]/page.tsx:34-77` (PipelineSheet render 10 stage bình đẳng)
- `supabase/migrations/013_customers.sql:19` (cột `pipeline` chỉ `TEXT NOT NULL DEFAULT 'Lead mới'` — không CHECK)

**Mô tả**:  
PATCH khách hàng chỉ whitelist tên field, không validate giá trị `pipeline`. Giao diện cho user bấm chọn **bất kỳ stage nào** trong 10 stage (Lead mới → Bảo trì + Lost), bất kể stage hiện tại. Không kiểm tra:
- Stage hiện tại là gì → có được phép chuyển sang stage mới không
- Có quote chấp nhận chưa (yêu cầu để sang "Chốt HĐ")
- Có contract chưa (yêu cầu để sang "Giao hàng" / "Nghiệm thu" / "Bảo hành")
- Tick đủ task của stage hiện tại chưa

**Hậu quả**:  
- Sales mở khách hàng "Lead mới" → bấm "Bảo trì" → skip 7 stage
- Phá vỡ toàn bộ KPI pipeline (% chuyển tiếp, thời gian stage, trend)
- Doanh số, commission, audit trail sai lệch
- Không có database CHECK constraint (chỉ xác nhận ở `migrations/013:19` là `NOT NULL DEFAULT`)

**Đề Xuất Khắc Phục**:
```sql
-- 1. Thêm CHECK constraint (migration 024)
ALTER TABLE customers
ADD CONSTRAINT chk_pipeline_value CHECK (
  pipeline IN ('Lead mới','Tiềm năng','Báo giá','Đàm phán','Chốt HĐ',
               'Giao hàng','Nghiệm thu','Bảo hành','Bảo trì','Lost')
);

-- 2. Tạo trigger PL/pgSQL validate_pipeline_transition
-- Enforce ma trận chuyển tiếp:
--   - Chỉ sang stage kề
--   - Hoặc stage sau
--   - Hoặc quay lùi 1 bước
--   - Hoặc sang 'Lost' từ bất kỳ stage nào (cần ly_do_tu_choi)
CREATE OR REPLACE FUNCTION validate_pipeline_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_stage_idx_old INT;
  v_stage_idx_new INT;
  v_stages TEXT[] := ARRAY['Lead mới','Tiềm năng','Báo giá','Đàm phán','Chốt HĐ',
                            'Giao hàng','Nghiệm thu','Bảo hành','Bảo trì','Lost'];
BEGIN
  IF NEW.pipeline != OLD.pipeline THEN
    v_stage_idx_old := array_position(v_stages, OLD.pipeline);
    v_stage_idx_new := array_position(v_stages, NEW.pipeline);
    
    -- Lost từ bất kỳ stage → cần ly_do_tu_choi
    IF NEW.pipeline = 'Lost' AND NEW.ly_do_tu_choi IS NULL THEN
      RAISE EXCEPTION 'Lost stage requires ly_do_tu_choi (reason)';
    END IF;
    
    -- Lost từ bất kỳ stage → OK
    IF NEW.pipeline = 'Lost' THEN
      RETURN NEW;
    END IF;
    
    -- Chỉ cho kế tiếp hoặc lùi 1 bước (business rule)
    IF v_stage_idx_new NOT IN (v_stage_idx_old + 1, v_stage_idx_old - 1) THEN
      RAISE EXCEPTION 'Invalid pipeline transition: % → %', OLD.pipeline, NEW.pipeline;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_pipeline_transition
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION validate_pipeline_transition();
```

**3. Cập nhật API** (`app/api/lark/customers/[id]/route.ts:85-97`):
```typescript
// Đọc stage cũ, verify transition
const { data: currentCustomer } = await supabase.from('customers')
  .select('pipeline').eq('id', customerId).single();
  
if (updates.pipeline && currentCustomer?.pipeline !== updates.pipeline) {
  // Validation sẽ được handle ở trigger, nhưng có thể pre-check ở API
  const isValidTransition = validateTransition(currentCustomer.pipeline, updates.pipeline);
  if (!isValidTransition) {
    return NextResponse.json(
      { error: `Invalid pipeline transition: ${currentCustomer.pipeline} → ${updates.pipeline}` },
      { status: 422 }
    );
  }
}
```

**4. Cập nhật UI** (`app/dashboard/customers/[id]/page.tsx:34-77`):
```typescript
// Chỉ render stage cho phép (stage kế tiếp + Lost)
const allowedStages = getValidTransitions(currentPipeline);
// Hay tối thiểu: thêm confirm dialog khi skip > 1 stage
```

**Ưu tiên**: 🔴 **NGAY** (1 giờ)  
**Phần của**: Đợt 1 (commit đơn lẻ sau khi fix C2, C4, C5, C7, C8)

---

### C2. `customer_id` LUÔN Mất Khi Tạo Hợp Đồng B2C

**File**:  
- `app/dashboard/orders/page.tsx:360-366` — form gửi `customer_record_id`
- `app/api/lark/orders/route.ts:104,115` — API đọc `customer_id` từ body

**Mô tả**:  
Form "Tạo hợp đồng B2C" gắn khách hàng bằng `setCustomerRecordId(c.record_id)` và POST body chứa `customer_record_id: customerRecordId`. Tuy nhiên API destructure `customer_id` ⇒ luôn `undefined` ⇒ INSERT vào DB với `customer_id: null`.

```typescript
// app/api/lark/orders/route.ts:104
const { customer_id, loai_hinh_nha, ...rest } = data;
// customer_id = undefined (vì body gửi customer_record_id, không customer_id)
```

**Hậu quả**:
- Mọi hợp đồng mới tạo **không link khách hàng** trong DB
- Bước sau `app/api/lark/orders/route.ts:128` check `if (data.customer_id)` → KHÔNG chạy → khách hàng pipeline không tự động sync về "Chốt HĐ"
- `autoCreateConstruction` (`contract/[id]/route.ts:13-29`) insert `customer_id: null` → không trace được KH
- Payment 3 đợt, commission, KPI… đều không tìm được khách hàng từ hợp đồng
- **Xác xứng**: Mở hợp đồng mới → field khách hàng trống → lưu → DB lưu `customer_id=null`

**Đề Xuất Khắc Phục** (1 dòng):

**Option A** — Sửa API (khuyên):
```typescript
// app/api/lark/orders/route.ts:104
const customerId = body.customer_id ?? body.customer_record_id;
const { loai_hinh_nha, ...rest } = body;
// Sau đó dùng customerId thay vì destructure customer_id
```

**Option B** — Sửa form (nếu lý do form thiết kế từ Lark):
```typescript
// app/dashboard/orders/page.tsx:360-366
const payload = {
  ...formData,
  customer_id: customerRecordId,  // Đổi key
  // customer_record_id: customerRecordId,  // Bỏ cái cũ
};
```

**Ưu tiên**: 🔴 **NGAY** (5 phút — 1 dòng)

---

### C3. FK `orders.quote_id` Tồn Tại Nhưng KHÔNG BAO GIỜ Được Set

**File**:  
- `supabase/migrations/016_orders.sql:14` — `quote_id BIGINT REFERENCES quotes(id)`
- `app/dashboard/orders/quote/[id]/page.tsx:506-516` — button "Tạo hợp đồng" gửi `?from_quote=`
- `app/dashboard/orders/page.tsx` — AddContractForm KHÔNG đọc param `from_quote`
- `app/api/lark/orders/route.ts` — POST không nhận `quote_id`

**Mô tả**:  
Bảng `orders` có cột `quote_id REFERENCES quotes(id)` để link hợp đồng sinh từ báo giá nào. Tuy nhiên:
1. UI navigates từ quote detail → `/dashboard/orders?action=add` nhưng form không đọc `from_quote` param
2. AddContractForm không pre-fill quote info
3. POST `/api/lark/orders` không có field `quote_id` trong whitelist allowed

Kết quả: Mọi hợp đồng tạo có `quote_id = null`.

**Hậu quả**:
- Không truy xuất được "Hợp đồng nào sinh từ báo giá nào" → mất audit trail
- Báo cáo tỷ lệ chuyển đổi báo giá → hợp đồng **không tính được** (đầu vào: BG, đầu ra: HĐ)
- Không tham chiếu giá, hạn chiết khấu từ BG chấp nhận → dễ tạo HĐ sai giá
- Commission sales không biết HĐ nào từ BG của mình

**Đề Xuất Khắc Phục**:

**1. Cập nhật AddContractForm** (`app/dashboard/orders/page.tsx`):
```typescript
// Constructor hoặc useEffect
const searchParams = useSearchParams();
const fromQuoteId = searchParams.get('from_quote');
const fromQuoteRecordId = searchParams.get('from_quote_record_id');

// Nếu có from_quote, tải quote data
useEffect(() => {
  if (fromQuoteId || fromQuoteRecordId) {
    loadQuote(fromQuoteId || fromQuoteRecordId);
  }
}, [fromQuoteId, fromQuoteRecordId]);

const handleSubmit = async (formData) => {
  const payload = {
    ...formData,
    quote_id: quote?.id,  // ← Thêm dòng này
    quote_record_id: quote?.record_id,
    customer_id: customer?.id,
    customer_record_id: customer?.record_id,
  };
  await API.createOrder(payload);
};
```

**2. Thêm `quote_id` vào API whitelist** (`app/api/lark/orders/route.ts`):
```typescript
const allowed = ['ma_hd', 'customer_id', 'customer_record_id', 'quote_id', 'quote_record_id', ...];
const data = pick(body, allowed);

// Sau khi tạo order, cập nhật quote
if (data.quote_id) {
  await supabase.from('quotes').update({ ma_hd_tham_chieu: created_order.ma_hd })
    .eq('id', data.quote_id);
}
```

**3. Cập nhật button navigasi** (`app/dashboard/orders/quote/[id]/page.tsx:506-516`):
```typescript
<button onClick={() => router.push(`/dashboard/orders?action=add&from_quote_record_id=${quote.record_id}`)}>
  Tạo hợp đồng
</button>
```

**Ưu tiên**: 🔴 **Đợt 1** (1 giờ)

---

### C4. `/api/tasks` Và `/api/payments` Bypass RLS Hoàn Toàn

**File**:  
- `app/api/tasks/route.ts:19,57,98` — `createServiceClient()` (service_role)
- `app/api/payments/route.ts:24,86,183,249` — `createServiceClient()` (service_role)

**Mô tả**:  
Cả 2 route đều dùng `createServiceClient()` → sử dụng `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` → skip mọi RLS policy. Auth chỉ check `await supabase.auth.getUser()` (user đã login), **không kiểm tra ownership KH**:

```typescript
// app/api/tasks/route.ts:40-81
export async function POST(req: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { customer_record_id, stage, task_key, notes } = await req.json();
  // Không kiểm tra: user có quyền access customer này không? (role/khu_vuc/nguoi_phu_trach)
  
  return await supabase.from('task_completions')  // ← service client, bypass RLS
    .upsert({ customer_record_id, stage, task_key, completed_by: user.id, notes, ... });
}

// GET /api/tasks?customer_record_id=123
// Bất kỳ user login nào cũng đọc được task của KH 123 (bất kể khu vực / nguoi_phu_trach)
```

**Hậu quả**:
- **Lộ dữ liệu**: Sales chi nhánh 1 đọc KH/task/payment của chi nhánh 2
- **Gãy business logic**: Sale A tick hộ task KH của sale B → task được ghi `completed_by = A.id` → KPI A tăng sai
- **Giả mạo**: Kế toán từ chi nhánh A tạo payment cho KH của chi nhánh B → doanh số sai, hành lang tài chính bỏ qua
- **Lỗ dữ liệu RLS**: `migrations/019_update_existing_tables.sql:57-73` viết RLS tốt nhưng bị vô hiệu hóa hoàn toàn

**Đề Xuất Khắc Phục**:

**Option 1 — Đổi sang `createClient()` (khuyên)**:
```typescript
// app/api/tasks/route.ts:24
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = createClient();  // ← Server client, RESPECT RLS
  const { data: { user } } = await supabase.auth.getUser();
  
  // RLS policy sẽ tự động filter:
  // - user role != admin → chỉ thấy task của KH mình quản lý
  // - task_completions_insert policy check `get_my_role() = ANY(roles_can_complete[stage][task])`
}
```

**Option 2 — Giữ service client + tự verify ownership**:
```typescript
// Nếu phải dùng service client (vd trigger cần full access)
const supabase = createServiceClient();

// Nhưng verify ownership trước mỗi op
const { data: customer } = await supabase
  .from('customers')
  .select('id, nguoi_phu_trach, khu_vuc')
  .eq('record_id', customer_record_id)
  .single();

if (customer.khu_vuc !== userProfile.khu_vuc && userProfile.role !== 'admin') {
  return NextResponse.json({ error: 'Access denied' }, { status: 403 });
}
```

**Áp dụng tương tự** cho `/api/payments/route.ts`.

**Ưu tiên**: 🔴 **NGAY** (30 phút — đổi 1 dòng x2 files)

---

### C5. Thứ Tự `PIPELINE_STAGES` SAI — Nghiệm Thu Đứng Trước Giao Hàng

**File**:  
- `lib/lark/tables.ts:18-29`

```typescript
export const PIPELINE_STAGES = [
  'Lead mới',
  'Tiềm năng',
  'Báo giá',
  'Đàm phán',
  'Chốt HĐ',
  'Nghiệm thu',      // ← SAI! Đứng trước Giao hàng
  'Giao hàng',       // ← SAI!
  'Bảo hành',
  'Bảo trì',
  'Lost',
];
```

**Mô tả**:  
Business flow đúng (theo business requirement + lib/tasks/checklist.ts):
- Chốt HĐ → **Giao hàng** → **Nghiệm thu** → Bảo hành

Nhưng array trong `tables.ts` đảo ngược 2 stage: `Chốt HĐ` → `Nghiệm thu` → `Giao hàng`.

**Hậu quả**:
- Progress bar ở `customers/[id]/page.tsx:264-275` render sai thứ tự progress
- `currentStageIdx = PIPELINE_STAGES.indexOf(pipeline)` — KH ở "Giao hàng" sẽ `idx=6`, nhưng "Chốt HĐ"=4 → progress trông như chỉ 5/9, sai
- PipelineSheet dropdown hiển thị sai thứ tự → sales chọn stage sai
- Mọi so sánh `currentStageIdx >= PIPELINE_STAGES.indexOf('...')` trên cả project sai logic

**Đề Xuất Khắc Phục** (1 dòng):

```typescript
// lib/lark/tables.ts:18-29
export const PIPELINE_STAGES = [
  'Lead mới',
  'Tiềm năng',
  'Báo giá',
  'Đàm phán',
  'Chốt HĐ',
  'Giao hàng',      // ← Chuyển lên (idx=5)
  'Nghiệm thu',     // ← Chuyển xuống (idx=6)
  'Bảo hành',
  'Bảo trì',
  'Lost',
];
```

**Sau khi fix**: Kiểm tra lại mọi chỗ dùng `indexOf` để verify logic vẫn đúng (nên có ít vị trí).

**Ưu tiên**: 🔴 **NGAY** (5 phút — 1 dòng + QA)

---

### C6. Không Có Automation Chuyển Pipeline → Giao Hàng / Nghiệm Thu / Bảo Trì

**File**:  
- `app/api/lark/orders/contract/[id]/route.ts:104-107`
- `app/api/lark/maintenance/construction/[id]/route.ts:92-95`

**Mô tả**:  
Khi hợp đồng chuyển tình trạng (tạo construction, xong thi công, xong nghiệm thu), khách hàng pipeline **không tự động chuyển**:

```typescript
// contracts/[id]/route.ts:104-107
if (trang_thai === 'Hoàn thành') {
  await supabase.from('customers').update({ pipeline: 'Bảo hành' })
    .eq('id', customer_id);
}
// Chỉ setting Bảo hành khi HĐ hoàn thành
// THIẾU: Giao hàng (khi Đang thi công), Nghiệm thu (khi Chờ nghiệm thu)

// maintenance/construction/[id]/route.ts:92-95
// Tạo maintenance_periodic nhưng KHÔNG cập nhật customer pipeline
```

Kết quả: Pipeline KH **dậm chân ở "Chốt HĐ"** suốt quá trình thi công (thường 3-6 tháng):
- Dashboard báo "Chốt HĐ", nhưng đang thi công ở tuần thứ 2
- KPI "% ở giai đoạn Chốt HĐ" sai (kéo dài không cần thiết)
- Sales cần bấm tay chuyển stage → quên → nhập liệu sai

**Đề Xuất Khắc Phục**:

**1. Mapping hợp lệ: contract.trang_thai → customer.pipeline**

```typescript
// Tạo hàm helper
export const CONTRACT_STAGE_TO_PIPELINE: Record<string, string> = {
  'Chưa khảo sát':      'Chốt HĐ',      // Ngay sau ký, chưa bước giao
  'Đang khảo sát':      'Giao hàng',    // Bắt đầu khảo sát → shift sang Giao
  'Đang thi công':      'Giao hàng',    // Thi công
  'Chờ nghiệm thu':     'Nghiệm thu',   // Chờ đặt lịch nghiệm
  'Nghiệm thu hoàn thành': 'Bảo hành',  // Đã ký biên bản
  'Hoàn thành':         'Bảo hành',     // Đã bàn giao
};
```

**2. Update contract route** (`app/api/lark/orders/contract/[id]/route.ts`):

```typescript
// Bước update contract trang_thai
const newPipeline = CONTRACT_STAGE_TO_PIPELINE[new_trang_thai] ?? 'Chốt HĐ';
await Promise.all([
  supabase.from('orders').update({ trang_thai: new_trang_thai }).eq('id', id),
  // TỰ ĐỘNG CẬP NHẬT PIPELINE
  supabase.from('customers').update({ pipeline: newPipeline }).eq('id', customer_id),
]);
```

**3. Auto-create maintenance + update pipeline** (`maintenance/construction/[id]/route.ts`):

```typescript
// Khi construction 'Nghiệm thu hoàn thành' → auto-create maintenance_periodic
const [, { data: newMaintenance }] = await Promise.all([
  supabase.from('customers').update({ pipeline: 'Bảo trì' }).eq('id', customer_id),
  supabase.from('maintenance_periodic').insert({ construction_id: id, ...maint_data }),
]);
```

**Ưu tiên**: 🔴 **Đợt 1** (1-2 giờ — mapping + 3 update calls)

---

### C7. Auto-Pipeline 'Chốt HĐ' Khi Accept Quote KHÔNG Có Guard

**File**:  
- `app/api/lark/quotes/[id]/route.ts:82-86`
- Compare vs `app/api/lark/quotes/route.ts:127-133` (có guard)

**Mô tả**:  
Khi PATCH quote status='Chấp nhận', API auto-update customer `pipeline='Chốt HĐ'` nhưng **KHÔNG kiểm tra stage hiện tại**:

```typescript
// quotes/[id]/route.ts:82-86
if (body.trang_thai === 'Chấp nhận') {
  await supabase.from('customers')
    .update({ pipeline: 'Chốt HĐ' })  // ← Không có .in('pipeline', [...])
    .eq('id', customerId);
}

// Vs tạo quote mới (quotes/route.ts:127-133):
await supabase.from('customers')
  .update({ pipeline: 'Báo giá' })
  .in('pipeline', ['Lead mới', 'Tiềm năng'])  // ← CÓ guard
  .eq('id', customerId);
```

**Hậu quả**:
- KH ở "Lead mới" → PATCH quote từ nháp thành 'Chấp nhận' → **thẳng vào "Chốt HĐ"** skip 4 stage
- Hoặc: KH ở "Từ chối" (Lost) → tạo lại quote cũ + accept → lôi nó từ "Lost" về "Chốt HĐ"
- KHÔNG theo dõi được tiến độ realistic

**Đề Xuất Khắc Phục**:

```typescript
// app/api/lark/quotes/[id]/route.ts:82-86
if (body.trang_thai === 'Chấp nhận') {
  // Chỉ update nếu pipeline hiện tại là Báo giá hoặc Đàm phán
  await supabase.from('customers')
    .update({ pipeline: 'Chốt HĐ' })
    .in('pipeline', ['Báo giá', 'Đàm phán'])  // ← Thêm guard
    .eq('id', customerId);
}
```

**Ưu tiên**: 🔴 **NGAY** (1 phút — 1 dòng `.in(...)`)

---

### C8. Quote 'Từ Chối' Đẩy KH Về 'Đàm Phán' (Kéo Lùi)

**File**:  
- `app/api/lark/quotes/[id]/route.ts:88-93`

**Mô tả**:  
Khi PATCH quote status='Từ chối', API update `customer.pipeline = 'Đàm phán'`:

```typescript
// quotes/[id]/route.ts:88-93
if (body.trang_thai === 'Từ chối') {
  await supabase.from('customers')
    .update({ pipeline: 'Đàm phán' })  // ← LỆNH QUAY LÙI
    .eq('id', customerId);
}
```

Nếu KH đang ở "Bảo hành" → gặp bug hoặc sales lỡ PATCH 1 báo giá cũ thành 'Từ chối' → KH bị kéo **từ "Bảo hành" về "Đàm phán"** → mất 3 stage tiến độ.

**Hậu quả**:
- Khách hàng Bảo hành/Bảo trì (đã hoàn thành hợp đồng, đang ổn định) đột ngột quay lùi
- Dữ liệu pipeline sai lệch hoàn toàn
- Không biết KH này ở đâu trong hành trình thực tế

**Đề Xuất Khắc Phục**:

```typescript
// app/api/lark/quotes/[id]/route.ts:88-93
if (body.trang_thai === 'Từ chối') {
  // Chỉ đổi pipeline về Đàm phán nếu KH HIỆN TẠI ở Báo giá
  // Nếu > Báo giá (Đàm phán trở đi) → đổi sang Lost, không Đàm phán
  const { data: customer } = await supabase.from('customers')
    .select('pipeline').eq('id', customerId).single();
  
  const newPipeline = PIPELINE_STAGES.indexOf(customer.pipeline) <= 
                       PIPELINE_STAGES.indexOf('Báo giá')
    ? 'Đàm phán'  // Lùi 1 bước
    : 'Lost';     // Quá điểm nên Lost
  
  await supabase.from('customers')
    .update({ pipeline: newPipeline, ly_do_tu_choi: body.ly_do_tu_choi })
    .eq('id', customerId);
}
```

**Ưu tiên**: 🔴 **Đợt 1** (30 phút)

---

## 🟠 HIGH (12 vấn đề) — Thiếu Ràng Buộc Gây Inconsistency

### H1. Không Có CHECK Constraint Giá Trị `pipeline`

**File**: `supabase/migrations/013_customers.sql:19`

**Mô tả**: Cột `pipeline` chỉ có `TEXT NOT NULL DEFAULT 'Lead mới'`. Có thể insert/update giá trị tùy ý qua raw SQL hoặc API bug.

**Hậu quả**: UI `PIPELINE_COLORS[pipeline]` trả `undefined` → crash render. `currentStageIdx = -1` → progress bar sai.

**Fix**: Thêm vào migration 024:
```sql
ALTER TABLE customers ADD CONSTRAINT chk_pipeline_valid CHECK (
  pipeline IN ('Lead mới','Tiềm năng','Báo giá','Đàm phán','Chốt HĐ',
               'Giao hàng','Nghiệm thu','Bảo hành','Bảo trì','Lost')
);
```

---

### H2. Tạo Báo Giá Không Yêu Cầu `customer_id`

**File**: `app/api/lark/quotes/route.ts:78`

```typescript
const customerId = customer_record_id ? ... : null;
```

BG được phép tạo không có KH. Sau đó không cách nào link ngược.

**Hậu quả**: "Báo giá mồ côi" lọt vào báo cáo doanh số. KPI conversion tính sai.

**Fix**: `customer_id` bắt buộc hoặc soft-filter (ẩn khỏi báo cáo có tag `is_orphan=true`).

---

### H3. Tạo Hợp Đồng B2C Không Kiểm Tra Đã Có Báo Giá Chấp Nhận

**File**: `app/api/lark/orders/route.ts:103-132`

Không query `quotes` với `trang_thai='Chấp nhận'` và `customer_id=X` trước khi tạo HĐ. Sales có thể tạo HĐ trực tiếp bỏ qua báo giá.

**Hậu quả**: Mất audit "Báo giá nào → Hợp đồng nào". Ràng buộc giá chiết khấu không được enforce.

**Fix**: POST /api/lark/orders (B2C) yêu cầu `quote_id` hoặc check tồn tại quote chấp nhận.

---

### H4. FK `payment.contract_record_id` Là TEXT — Không FK Thực

**File**: `supabase/migrations/011_payment_records.sql:9` — `contract_record_id TEXT`

Và `customer_record_id TEXT` cũng không FK → orphan payment khi xóa KH.

Migration 019 thêm `customer_id BIGINT REFERENCES customers(id)` nhưng API không ghi.

**Hậu quả**: Cascade delete không work. Dữ liệu lỏng lẻo.

**Fix**: Sử dụng `customer_id` (đã thêm ở 019) + API ghi vào nó.

---

### H5. Chuyển Stage Không Check Payment Prerequisite

**Mô tả**: Không code nào kiểm tra khi PATCH customer pipeline:
- Sang "Giao hàng" → cần `payments[0].is_paid=true` (Đợt 1)
- Sang "Nghiệm thu" → cần `payments[1].is_paid=true` (Đợt 2)
- Sang "Bảo hành" → cần `payments[2].is_paid=true` (Đợt 3) + `construction.trang_thai='Hoàn thành'`

**Hậu quả**: KH có thể chuyển "Bảo hành" mà chưa TT đợt 1, 2, 3. Kế toán phải đối soát thủ công.

**Fix**: Validation trước PATCH (server-side):
```typescript
const [payments, construction] = await Promise.all([
  supabase.from('payment_records').select('installment, is_paid').eq('customer_id', cid),
  supabase.from('constructions').select('trang_thai').eq('customer_id', cid).single(),
]);
const p = payments.reduce((acc, x) => ({ ...acc, [x.installment]: x.is_paid }), {});

if (newPipeline === 'Giao hàng' && !p[1]) return 422;
if (newPipeline === 'Nghiệm thu' && !p[2]) return 422;
if (newPipeline === 'Bảo hành' && (!p[3] || construction.trang_thai !== 'Hoàn thành')) return 422;
```

---

### H6. Task Checklist Không Bắt Buộc Tick Hết Mới Chuyển Stage

**File**: `components/TaskChecklist.tsx` chỉ hiển thị progress. `customers/[id]/page.tsx:198` `updatePipeline` không check completion.

**Hậu quả**: Checklist thành optional, quy trình không enforce.

**Fix**: Server validate trước PATCH:
```typescript
const completed = await supabase.from('task_completions')
  .select('task_key').eq('customer_id', cid).eq('stage', oldPipeline);
const required = STAGE_TASKS[oldPipeline].length;
if (completed.length < required) return 422 'All tasks required before transition';
```

---

### H7-H8. `task_completions.customer_id` & `payment_records.customer_id` Luôn NULL

**File**: `/api/tasks:40-81` & `/api/payments:89-107` không set `customer_id`, chỉ `customer_record_id`.

RLS policy dựa vào `customer_id IS NOT NULL` → với non-admin role sẽ vô hình → bom nổi chậm nếu bỏ service client (xem C4).

**Fix**: Lookup `customers.id` từ `record_id`, ghi `customer_id`.

---

### H9. ON DELETE CASCADE Quá Rộng

**File**: `quotes.customer_id ON DELETE CASCADE`, `orders.customer_id CASCADE`, `task_completions.customer_id CASCADE`, `payment_records.customer_id CASCADE`

Admin xóa 1 KH → wipe mọi báo giá, HĐ, thanh toán, task → mất lịch sử tài chính → không undo.

**Fix**: Đổi sang `ON DELETE RESTRICT` cho orders/payment_records. Dùng soft-delete (`is_archived`) thay vì DELETE.

---

### H10. Race Condition 2 Sales Cùng Update 1 KH

**File**: `app/api/lark/customers/[id]/route.ts:75-119`

Không optimistic lock (không compare `updated_at`/version). Last-write-wins, pipeline_history có thể lẫn lộn.

**Fix**: Thêm `version INT DEFAULT 1` → client gửi `version` cũ → PATCH `WHERE version = ?` và `SET version = version + 1` → 409 Conflict nếu 0 row.

---

### H11. Trigger `log_pipeline_change` Phụ Thuộc `auth.uid()` Có Thể NULL

**File**: `migrations/018_pipeline_history.sql:22-31` dùng `auth.uid()` trong trigger.

Khi API service client update, `auth.uid()` là NULL → `pipeline_history.changed_by = NULL`. Mất trace ai thay đổi.

**Fix**: Set `current_setting('app.actor')` từ API server, fallback trigger.

---

### H12. Không Ràng Buộc "BG Chỉ 1 Cái Chấp Nhận Trên 1 KH"

**File**: `supabase/migrations/015_quotes.sql` — không unique index.

Có thể 5 BG cùng "Chấp nhận" cho 1 KH → không biết cái nào thành HĐ.

**Fix**: 
```sql
CREATE UNIQUE INDEX uniq_accepted_quote_per_customer ON quotes(customer_id) 
WHERE trang_thai='Chấp nhận';
```

Hoặc auto-set các BG khác thành 'Bị thay thế' khi accept 1 BG.

---

## 🟡 MEDIUM (13 vấn đề) — UX / Quy Trình Chưa Chặt

- **M1**: PipelineSheet hiển thị 10 stage bình đẳng, không disable stage trước, không confirm khi skip/lùi
- **M2**: Stage "Lost" không bắt buộc `ly_do_tu_choi`
- **M3**: KH Lost vẫn tạo được BG/HĐ/payment → không block ở API
- **M4**: `payment.UNIQUE(customer_record_id, installment)` — KH có 2 HĐ B2C đụng unique → phải dùng `(order_id, installment)`
- **M5**: `autoCreateConstruction` chỉ copy `san_pham[0]` → mất SP còn lại
- **M6**: `maintenance_periodic.chu_ky=6` tháng hardcoded → phải đọc từ product config
- **M7**: `ngay_gui_kh` BG không auto-set khi đổi status='Đã gửi'
- **M8**: `quote.ngay_het_han = ngày lập + 14 ngày` hardcoded → config vào `company_settings.quote_expiry_days`
- **M9**: PaymentSection visibility tình cờ work do C5 (sai thứ tự) → cần QA lại sau fix C5
- **M10**: `/api/tasks` POST không validate `task_key` thuộc đúng `stage`
- **M11**: `canCompleteTask` chỉ check UI → server không re-check role
- **M12**: Quote 'Chấp nhận' không yêu cầu `ma_hd_tham_chieu`
- **M13**: Commercial/Project orders không liên kết pipeline customer (chỉ B2C)

---

## 🟢 LOW (11 vấn đề) — Polish

- **L1**: `void supabase.update(...)` fire-and-forget → silent fail, pipeline sync miss
- **L2**: Mã HĐ/BG dùng `Date.now().slice(-4)` → collision, không UNIQUE constraint
- **L3**: Không soft-delete customer (dùng DELETE cứng)
- **L4**: `pipeline_history.changed_by=NULL` khi service client (xem H11)
- **L5**: `quote.phien_ban` race khi 2 user tạo cùng lúc → cần UNIQUE `(customer_id, phien_ban)` + retry
- **L6**: `payment.contract_record_id` TEXT legacy → đổi sang `order_id BIGINT FK`
- **L7**: Customer POST không validate format SDT (phone number)
- **L8**: Quote PATCH nên có double-defense role check (RLS + API)
- **L9**: Bảng `quote_items` (schema OK) KHÔNG được populate → lost `don_gia`, `so_luong` chi tiết
- **L10**: `PipelineSheet` race nhẹ ở onSelect/onClose
- **L11**: `QUOTE_STATUSES` cần CHECK constraint giống `pipeline`

---

## 📋 Thứ Tự Ưu Tiên & Phân Công

### 🔴 **Đợt 1 (NGAY — 2-3 giờ)**
Tập trung: Sửa 5 bug Critical nhẹ nhất (C2, C4, C5, C7, C8) → **1 commit đơn lẻ**

| ID | Công việc | File | Nỗ lực | Priority |
|----|---------|----|--------|----------|
| C2 | Fix customer_id không được ghi | `app/api/lark/orders/route.ts:104` | 5 min | 🔴 HIGHEST |
| C5 | Fix thứ tự pipeline Giao hàng/Nghiệm thu | `lib/lark/tables.ts:18-29` | 5 min + QA 15 min | 🔴 HIGH |
| C4 | Đổi service client → server client (/api/tasks, /api/payments) | 2 files | 30 min | 🔴 HIGH |
| C7 | Thêm guard `.in('Báo giá','Đàm phán')` khi accept quote | `quotes/[id]/route.ts:82-86` | 5 min | 🔴 HIGH |
| C8 | Fix quote "Từ chối" lôi KH lùi | `quotes/[id]/route.ts:88-93` | 30 min | 🔴 HIGH |

**Commit message**: `fix(core): critical pipeline & customer linkage issues — C2 C4 C5 C7 C8`

---

### 🟠 **Đợt 2 (Tuần này — 4-5 giờ)**
Gom C1, H1, H12 + C3, C6 → **1-2 commits**

| ID | Công việc | File | Nỗ lực |
|----|---------|----|--------|
| C1 + H1 | CHECK constraint + trigger pipeline transition validation | `migrations/024_pipeline_constraints.sql` | 2 giờ |
| C3 | Link quote → contract (from_quote param, quote_id FK) | `orders/page.tsx`, `/api/lark/orders` | 1 giờ |
| C6 | Auto-update pipeline Giao hàng/Nghiệm thu/Bảo trì | 3 contract routes | 1 giờ |
| H12 | UNIQUE index accepted quote per customer | `migrations/024` | 10 min |

**Commits**: 
- `feat(db): add pipeline transition validation (C1+H1+H12)`
- `fix(contracts): auto-update pipeline + link quote (C3+C6)`

---

### 🟠 **Đợt 3 (Sprint 1 — 6-8 giờ)**
Gom H3, H5, H6, H7, H8 → kiểm tra prerequisite & fix FK

| ID | Công việc | File | Nỗ lực |
|----|---------|----|--------|
| H3 | Check quote accepted trước tạo HĐ | `/api/lark/orders` | 45 min |
| H5 | Validate payment prerequisite khi PATCH pipeline | `/api/lark/customers/[id]` | 1 giờ |
| H6 | Validate task checklist completion | `/api/lark/customers/[id]` | 45 min |
| H7 + H8 | Populate `customer_id` ở /api/tasks & /api/payments | 2 files | 1 giờ |

**Commit**: `fix(validation): add prerequisite checks for pipeline transitions`

---

### 🟢 **Backlog (Sau 1 tuần)**
H4, H9, H10, H11, L-series, M-series

---

## 📝 Checklist Triển Khai

- [ ] Đợt 1: Commit C2/C4/C5/C7/C8 → deploy Vercel → test
- [ ] Đợt 2: Commit C1+H1+H12 (migration), C3+C6 → test E2E
- [ ] Đợt 3: Commit H3/H5/H6/H7/H8 → test with payment scenarios
- [ ] QA: Pipeline transition matrix (lead → lost, chốt HĐ → bảo hành, etc.)
- [ ] QA: Auto-pipeline: tạo contract → check KH pipeline auto-chuyển
- [ ] QA: Payment 3-đợt: check không chuyển stage nếu chưa TT
- [ ] Docs: Update business rules (linkage diagram)

---

**Báo cáo hoàn thành**: 2026-04-16  
**Tác giả**: Claude Opus (Audit Agent)  
**Dự kiến fix xong Đợt 1**: 2026-04-16 (EOD)  
**Dự kiến fix xong Đợt 2-3**: 2026-04-23 (EOW)
