/**
 * Task checklist definitions theo từng stage pipeline.
 * Nguồn: "Lộ trình kinh doanh.xlsx" — Sheet3, Phase 5.
 *
 * roles_can_complete: các role được phép tick task này.
 * role_badge: role hiển thị trên badge (chịu trách nhiệm chính).
 */

export interface TaskDef {
  key: string
  label: string
  role_badge: string           // hiển thị badge nhân sự chính
  roles_can_complete: string[] // ai được tick (admin/ceo luôn có quyền)
}

export const STAGE_TASKS: Record<string, TaskDef[]> = {
  'Lead mới': [
    {
      key: 'lead_01',
      label: 'Nhập khách hàng vào CRM',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
    {
      key: 'lead_02',
      label: 'Ghi nguồn khách hàng',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
    {
      key: 'lead_03',
      label: 'Gọi điện xác nhận nhu cầu',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
    {
      key: 'lead_04',
      label: 'Phân loại tiềm năng (A / B / C)',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
  ],

  'Tiềm năng': [
    {
      key: 'tiem_01',
      label: 'Liên hệ hẹn gặp khách hàng',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
    {
      key: 'tiem_02',
      label: 'Khảo sát nhu cầu thực tế',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
    {
      key: 'tiem_03',
      label: 'Ghi log liên hệ vào hệ thống',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
    {
      key: 'tiem_04',
      label: 'Lên kế hoạch tiếp cận tiếp theo',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
  ],

  'Báo giá': [
    {
      key: 'bq_01',
      label: 'Khảo sát công suất kỹ thuật',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'bq_02',
      label: 'Soạn 3 phương án báo giá',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
    {
      key: 'bq_03',
      label: 'Kỹ thuật review phương án báo giá',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'bq_04',
      label: 'Gửi báo giá cho khách hàng',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
  ],

  'Đàm phán': [
    {
      key: 'dn_01',
      label: 'Thuyết phục bằng sơ đồ nguyên lý',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
    {
      key: 'dn_02',
      label: 'Xử lý objection của khách hàng',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
    {
      key: 'dn_03',
      label: 'Ghi nhận đối thủ cạnh tranh',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
  ],

  'Chốt HĐ': [
    {
      key: 'chd_01',
      label: 'Soạn hợp đồng',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
    {
      key: 'chd_02',
      label: 'Trưởng phòng kiểm tra hợp đồng',
      role_badge: 'TP Sales',
      roles_can_complete: ['tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'chd_03',
      label: 'Kế toán kiểm tra hợp đồng',
      role_badge: 'Kế toán',
      roles_can_complete: ['accountant', 'admin', 'ceo'],
    },
    {
      key: 'chd_04',
      label: 'Khách hàng ký HĐ — thu thanh toán 60%',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'accountant', 'admin', 'ceo'],
    },
    {
      key: 'chd_05',
      label: 'Kỹ thuật khảo sát lần 2',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'chd_06',
      label: 'Kỹ sư xem bản vẽ, chuẩn bị điều kiện thi công',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'chd_07',
      label: 'Sale yêu cầu KH cung cấp giấy giới thiệu đại diện',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
  ],

  'Giao hàng': [
    {
      key: 'gh_01',
      label: 'Kế toán xác nhận thu thanh toán 35%',
      role_badge: 'Kế toán',
      roles_can_complete: ['accountant', 'admin', 'ceo'],
    },
    {
      key: 'gh_02',
      label: 'Kiểm tra đủ vật tư: lọc nhỏ, lọc tổng, heatpump, sàn sưởi',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'logistics', 'admin', 'ceo'],
    },
    {
      key: 'gh_03',
      label: 'Xuất kho, ký biên bản xuất hàng',
      role_badge: 'Hậu cần',
      roles_can_complete: ['logistics', 'accountant', 'admin', 'ceo'],
    },
    {
      key: 'gh_04',
      label: 'Giao hàng đến chân công trình, ký biên bản nhận',
      role_badge: 'Hậu cần',
      roles_can_complete: ['logistics', 'tech', 'admin', 'ceo'],
    },
    {
      key: 'gh_05',
      label: 'Thi công, lắp đặt thiết bị',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'gh_06',
      label: 'Vệ sinh công trình cuối ngày, báo cáo Zalo trước khi rời',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'gh_07',
      label: 'Marketing quay video toàn bộ quá trình giao — thi công',
      role_badge: 'Marketing',
      roles_can_complete: ['admin', 'ceo'],
    },
  ],

  'Nghiệm thu': [
    {
      key: 'nt_01',
      label: 'Vận hành, kiểm tra toàn bộ thiết bị',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'nt_02',
      label: 'Lập biên bản nghiệm thu, các bên ký xác nhận',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'nt_03',
      label: 'Quay video + chụp ảnh hoàn thiện sản phẩm',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'nt_04',
      label: 'Thu thanh toán đợt 3 — 5% còn lại',
      role_badge: 'Kế toán',
      roles_can_complete: ['accountant', 'sales', 'admin', 'ceo'],
    },
    {
      key: 'nt_05',
      label: 'Xin giấy giới thiệu hoặc referral cho KH / đối tác mới',
      role_badge: 'Kinh doanh',
      roles_can_complete: ['sales', 'admin', 'ceo'],
    },
  ],

  'Bảo hành': [
    {
      key: 'bh_01',
      label: 'Tiếp nhận yêu cầu bảo hành từ khách hàng',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'bh_02',
      label: 'Xử lý lỗi / thay thế linh kiện',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'bh_03',
      label: 'Ghi nhận lịch sử bảo hành vào hệ thống',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
  ],

  'Bảo trì': [
    {
      key: 'bt_01',
      label: 'Lên lịch bảo trì định kỳ',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'bt_02',
      label: 'Thực hiện bảo trì theo lịch',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'bt_03',
      label: 'Báo cáo tình trạng máy sau bảo trì',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
    {
      key: 'bt_04',
      label: 'Đề xuất nâng cấp thiết bị nếu cần',
      role_badge: 'Kỹ thuật',
      roles_can_complete: ['tech', 'tech_lead', 'admin', 'ceo'],
    },
  ],
}

/** Tổng số task của một stage */
export function countStageTasks(stage: string): number {
  return STAGE_TASKS[stage]?.length ?? 0
}

/** Kiểm tra role có được tick task không (admin/ceo luôn có quyền) */
export function canCompleteTask(task: TaskDef, role: string): boolean {
  if (role === 'admin' || role === 'ceo') return true
  return task.roles_can_complete.includes(role)
}
