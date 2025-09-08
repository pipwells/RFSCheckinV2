// src/app/admin/layout.tsx
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  // Minimal shell so /admin/login is totally clean
  return <>{children}</>;
}
