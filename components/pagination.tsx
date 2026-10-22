export function Pagination({ page, pageSize, total, onPageChange }: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  if (total <= pageSize) return <div className="pagination-bar"><span>แสดง {start}–{end} จาก {total} รายการ</span></div>;

  return <nav className="pagination-bar" aria-label="แบ่งหน้ารายการ">
    <span>แสดง {start}–{end} จาก {new Intl.NumberFormat("th-TH").format(total)} รายการ</span>
    <div>
      <button type="button" className="secondary-button small-button" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>ก่อนหน้า</button>
      <span>หน้า {currentPage} / {pageCount}</span>
      <button type="button" className="secondary-button small-button" disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)}>ถัดไป</button>
    </div>
  </nav>;
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), lastPage);
  return items.slice((currentPage - 1) * pageSize, currentPage * pageSize);
}
