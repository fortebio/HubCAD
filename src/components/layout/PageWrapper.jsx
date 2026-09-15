import { Header } from './Header.jsx';

export function PageWrapper({ title, subtitle, breadcrumb, action, children }) {
  return (
    <div className="flex-1 flex flex-col min-h-screen min-w-0">
      <Header title={title} subtitle={subtitle} breadcrumb={breadcrumb} action={action} />
      {/* Target of the skip link; tabIndex lets focus land here. */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 p-4 md:p-6 overflow-x-hidden outline-none"
      >
        {children}
      </main>
    </div>
  );
}
