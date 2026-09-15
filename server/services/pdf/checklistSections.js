// Server-side mirror of the bilingual checklist data.
// Kept in sync with src/data/{checklistItems,dfmItems,releaseItems}.js.

export const DRAWING_SECTIONS = [
  {
    title: { en: 'Title block & metadata', vn: 'Khung tên & thông tin' },
    items: [
      { en: 'Part number and revision are filled in correctly', vn: 'Số part và revision được điền đúng' },
      { en: 'Drawing title (EN + VN) is clear and unambiguous', vn: 'Tiêu đề bản vẽ (EN + VN) rõ ràng, không mơ hồ' },
      { en: 'Designer, checker, approver fields are populated', vn: 'Các ô người thiết kế, kiểm tra, phê duyệt đã điền' },
      { en: 'Drawing scale matches printed dimensions', vn: 'Tỉ lệ bản vẽ khớp với kích thước in' },
      { en: 'Drawing sheet size and standard (ISO 7200) declared', vn: 'Khổ giấy và tiêu chuẩn (ISO 7200) đã ghi' },
    ],
  },
  {
    title: { en: 'Views & projection', vn: 'Hình chiếu' },
    items: [
      { en: 'Projection method (1st or 3rd angle) is indicated', vn: 'Phương pháp chiếu (góc 1 hoặc góc 3) đã ghi' },
      { en: 'All necessary views shown (front/top/side/iso)', vn: 'Đủ các hình chiếu cần thiết (đứng/bằng/cạnh/iso)' },
      { en: 'Section and detail views are correctly labelled', vn: 'Mặt cắt và chi tiết phóng to có nhãn đúng' },
      { en: 'Hidden lines used only where necessary', vn: 'Đường khuất chỉ dùng khi thực sự cần' },
    ],
  },
  {
    title: { en: 'Dimensions & tolerances', vn: 'Kích thước & dung sai' },
    items: [
      { en: 'All critical dimensions are toleranced', vn: 'Tất cả kích thước quan trọng đều có dung sai' },
      { en: 'General tolerance class (ISO 2768) declared', vn: 'Cấp dung sai chung (ISO 2768) đã ghi' },
      { en: 'No redundant or over-dimensioning', vn: 'Không có kích thước thừa hoặc lặp lại' },
      { en: 'Hole positions referenced from datum', vn: 'Vị trí lỗ tham chiếu từ chuẩn (datum)' },
      { en: 'Thread callouts use ISO format (e.g. M3 x 0.5)', vn: 'Ren được ghi theo ISO (vd. M3 x 0.5)' },
    ],
  },
  {
    title: { en: 'GD&T & surface', vn: 'GD&T & bề mặt' },
    items: [
      { en: 'Geometric tolerances follow ISO 1101', vn: 'Dung sai hình học theo ISO 1101' },
      { en: 'Datums identified with reference letters', vn: 'Chuẩn được ghi rõ bằng chữ cái' },
      { en: 'Surface roughness symbols where required', vn: 'Có ký hiệu độ nhám bề mặt khi cần' },
    ],
  },
  {
    title: { en: 'Material & finish', vn: 'Vật liệu & xử lý bề mặt' },
    items: [
      { en: 'Material specification clearly stated', vn: 'Vật liệu được ghi rõ ràng' },
      { en: 'Surface treatment / coating defined', vn: 'Xử lý bề mặt / lớp phủ được mô tả' },
      { en: 'Heat treatment specified if applicable', vn: 'Có ghi nhiệt luyện nếu áp dụng' },
    ],
  },
  {
    title: { en: 'Notes & general', vn: 'Ghi chú & tổng thể' },
    items: [
      { en: 'General notes bilingual (EN + VN)', vn: 'Ghi chú chung song ngữ (EN + VN)' },
      { en: 'Unit of measurement (mm) declared', vn: 'Đơn vị đo (mm) được ghi rõ' },
      { en: 'Sharp edges / deburr requirement noted', vn: 'Yêu cầu vát mép / khử bavia được ghi' },
      { en: 'No conflicting or contradictory notes', vn: 'Không có ghi chú mâu thuẫn' },
    ],
  },
  {
    title: { en: 'Revision & approval', vn: 'Sửa đổi & phê duyệt' },
    items: [
      { en: 'Revision history table is up to date', vn: 'Bảng lịch sử sửa đổi được cập nhật' },
      { en: 'ECR / ECO reference noted for this revision', vn: 'Đã ghi ECR / ECO cho lần sửa này' },
      { en: 'No unsigned approval slots before release', vn: 'Không còn ô phê duyệt chưa ký trước khi phát hành' },
      { en: 'Drawing exported as PDF with correct file name', vn: 'Bản vẽ xuất PDF đúng quy ước đặt tên file' },
    ],
  },
];

export const DFM_SECTIONS = [
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

export const RELEASE_SECTIONS = [
  {
    audience: 'vendor',
    title: { en: 'Vendor package', vn: 'Gói cho nhà cung ứng' },
    items: [
      { en: '2D drawing PDF exported with title block', vn: 'PDF bản vẽ 2D có khung tên' },
      { en: 'STEP / 3D model attached', vn: 'Đính kèm file STEP / mô hình 3D' },
      { en: 'Material specification document attached', vn: 'Đính kèm tài liệu mô tả vật liệu' },
      { en: 'Surface finish and treatment notes included', vn: 'Có ghi xử lý bề mặt và lớp phủ' },
      { en: 'Quantity and lead time confirmed', vn: 'Số lượng và lead time đã xác nhận' },
      { en: 'Quality acceptance criteria written down', vn: 'Tiêu chí chấp nhận chất lượng đã viết rõ' },
      { en: 'NDA / IP agreement on file', vn: 'Có thỏa thuận bảo mật / sở hữu trí tuệ' },
      { en: 'Watermark "For Production" applied', vn: 'Đã đóng dấu "For Production"' },
    ],
  },
  {
    audience: 'oem',
    title: { en: 'OEM factory package', vn: 'Gói cho nhà máy OEM' },
    items: [
      { en: 'BOM exported with current revisions', vn: 'Xuất BOM theo revision hiện hành' },
      { en: 'Work Instruction (WI) PDF attached', vn: 'Đính kèm WI dạng PDF' },
      { en: 'Assembly drawings included', vn: 'Có bản vẽ lắp ráp' },
      { en: 'Process flow / sequence defined', vn: 'Quy trình / trình tự sản xuất xác định' },
      { en: 'Test procedure for incoming QC', vn: 'Quy trình kiểm tra đầu vào' },
      { en: 'Packaging / shipping instructions', vn: 'Hướng dẫn đóng gói / vận chuyển' },
      { en: 'Tooling and fixture drawings included', vn: 'Có bản vẽ dụng cụ / đồ gá' },
      { en: 'First Article Inspection (FAI) report template', vn: 'Có mẫu báo cáo FAI' },
      { en: 'ECN log up to date', vn: 'Nhật ký ECN cập nhật' },
    ],
  },
  {
    audience: 'sales',
    title: { en: 'Sales & web package', vn: 'Gói cho kinh doanh & web' },
    items: [
      { en: 'Product datasheet PDF (bilingual)', vn: 'Tờ thông số sản phẩm song ngữ' },
      { en: 'High-res product photos (3+ angles)', vn: 'Ảnh sản phẩm phân giải cao (≥ 3 góc)' },
      { en: 'Render images for marketing', vn: 'Ảnh render cho marketing' },
      { en: 'Web copy (EN + VN) reviewed', vn: 'Nội dung web (EN + VN) đã duyệt' },
      { en: 'Pricing approved by manager', vn: 'Giá bán đã được duyệt' },
      { en: 'Certifications listed (CE, FCC, RoHS, etc.)', vn: 'Đã liệt kê chứng nhận (CE, FCC, RoHS, ...)' },
      { en: 'Quick start guide attached', vn: 'Đính kèm hướng dẫn nhanh' },
      { en: 'Warranty and support terms documented', vn: 'Có điều khoản bảo hành và hỗ trợ' },
      { en: 'Internal release announcement sent', vn: 'Đã gửi thông báo phát hành nội bộ' },
    ],
  },
];

export const DRAWING_CHECKLIST = {
  drawing: DRAWING_SECTIONS,
  dfm: DFM_SECTIONS,
  release: RELEASE_SECTIONS,
};
