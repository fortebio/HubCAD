// Release checklist — gates a document from "approved" to "released"
// Organised by the three output audiences: vendor, OEM factory, sales/web.
export const RELEASE_CHECKLIST = [
  {
    audience: 'vendor',
    title: { en: 'Vendor package', vn: 'Gói cho nhà cung ứng' },
    accent: 'deliver',
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
    accent: 'publish',
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
    accent: 'review',
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

export const TOTAL_RELEASE_ITEMS = RELEASE_CHECKLIST.reduce((s, sec) => s + sec.items.length, 0);
