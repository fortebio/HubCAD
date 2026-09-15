// DFM / DFA checklist — electronics & consumer plastics manufacturing.
export const DFM_CHECKLIST = [
  {
    title: { en: 'Plastic part design (DFM)', vn: 'Chi tiết nhựa (DFM)' },
    items: [
      { en: 'Wall thickness is uniform (no thick/thin transitions > 2x)', vn: 'Bề dày đồng đều (không chênh > 2 lần)' },
      { en: 'Draft angles ≥ 1° on all vertical walls', vn: 'Góc thoát ≥ 1° trên tất cả vách đứng' },
      { en: 'Internal corners filleted to reduce stress', vn: 'Góc trong được bo để giảm ứng suất' },
      { en: 'Ribs ≤ 60% of nominal wall thickness', vn: 'Gân tăng cứng ≤ 60% bề dày tường' },
      { en: 'Bosses for screws have ribs and proper hole diameter', vn: 'Trụ vít có gân và lỗ đúng kích thước' },
      { en: 'Snap fits dimensioned with deflection clearance', vn: 'Ngàm khóa có dung sai biến dạng' },
      { en: 'Parting line and gate location specified', vn: 'Đường phân khuôn và vị trí miệng phun xác định' },
    ],
  },
  {
    title: { en: 'Machining (CNC)', vn: 'Gia công CNC' },
    items: [
      { en: 'Internal radii ≥ tool radius (typ. 1.0 mm)', vn: 'Bán kính trong ≥ bán kính dao (≥ 1.0 mm)' },
      { en: 'Deep pockets have aspect ratio < 4:1', vn: 'Hốc sâu có tỉ lệ < 4:1' },
      { en: 'Tapped holes have proper drill depth + relief', vn: 'Lỗ ren có chiều sâu khoan + giảm tải' },
      { en: 'No undercuts unless explicitly required', vn: 'Không có hốc lõm trừ khi bắt buộc' },
      { en: 'Tolerance not tighter than required for function', vn: 'Dung sai không chặt hơn mức cần thiết' },
      { en: 'Surface finish achievable with standard tools', vn: 'Độ nhám bề mặt khả thi với dao tiêu chuẩn' },
    ],
  },
  {
    title: { en: 'PCB / Electronics (IPC-2221)', vn: 'PCB / Điện tử (IPC-2221)' },
    items: [
      { en: 'Minimum trace width and spacing per current rating', vn: 'Bề rộng & khoảng cách trace theo dòng tải' },
      { en: 'Via size and annular ring within fab capability', vn: 'Via và vành đồng nằm trong khả năng nhà máy' },
      { en: 'Component clearances ≥ 0.2 mm', vn: 'Khoảng hở linh kiện ≥ 0.2 mm' },
      { en: 'Solder mask and silkscreen clearance ok', vn: 'Khoảng hở solder mask và silkscreen ổn' },
      { en: 'Test points placed on top side only', vn: 'Điểm test đặt trên mặt trên' },
      { en: 'Fiducials placed for SMT placement', vn: 'Có dấu fiducial cho lắp SMT' },
    ],
  },
  {
    title: { en: 'Assembly (DFA)', vn: 'Lắp ráp (DFA)' },
    items: [
      { en: 'Parts can be assembled in one direction', vn: 'Lắp ráp được theo một chiều' },
      { en: 'No fasteners hidden under other parts', vn: 'Không có vít bị che bởi chi tiết khác' },
      { en: 'Self-locating features (pins, tabs) included', vn: 'Có chi tiết tự định vị (chốt, gờ)' },
      { en: 'Common fasteners used across product', vn: 'Vít chuẩn được dùng chung toàn sản phẩm' },
      { en: 'No tools needed beyond standard kit', vn: 'Không cần dụng cụ ngoài bộ tiêu chuẩn' },
    ],
  },
  {
    title: { en: 'Cost & sourcing', vn: 'Chi phí & nguồn cung' },
    items: [
      { en: 'Material is locally sourceable in Vietnam', vn: 'Vật liệu có nguồn cung trong nước Việt Nam' },
      { en: 'No exotic processes (EDM, 5-axis) unless justified', vn: 'Không yêu cầu công nghệ đắt (EDM, 5 trục) trừ khi cần' },
      { en: 'Tooling cost estimated and approved', vn: 'Chi phí khuôn / dao đã ước tính và duyệt' },
      { en: 'Lead time acceptable for the production schedule', vn: 'Thời gian giao hàng phù hợp lịch sản xuất' },
    ],
  },
  {
    title: { en: 'Compliance & safety', vn: 'Tuân thủ & an toàn' },
    items: [
      { en: 'RoHS / REACH compliant materials', vn: 'Vật liệu đạt RoHS / REACH' },
      { en: 'No sharp edges that can cause injury', vn: 'Không có cạnh sắc gây thương tích' },
      { en: 'Flammability rating (UL94) where applicable', vn: 'Cấp chống cháy (UL94) khi cần' },
      { en: 'Labels and markings comply with regulation', vn: 'Nhãn và ký hiệu tuân thủ quy định' },
      { en: 'IPX rating verified if product is water exposed', vn: 'Cấp IPX kiểm tra nếu tiếp xúc nước' },
    ],
  },
];

export const TOTAL_DFM_ITEMS = DFM_CHECKLIST.reduce((s, sec) => s + sec.items.length, 0);
