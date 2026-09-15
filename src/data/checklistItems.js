// Drawing checklist — based on ISO 128 / ISO 7200 / ISO 2768.
// Sections + items, bilingual EN/VN.

export const DRAWING_CHECKLIST = [
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

export const TOTAL_DRAWING_ITEMS = DRAWING_CHECKLIST.reduce((s, sec) => s + sec.items.length, 0);
