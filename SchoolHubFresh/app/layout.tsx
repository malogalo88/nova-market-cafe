import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <div id="root">{children}</div>
      </body>
    </html>
  )
}

export const metadata = {
  title: 'SchoolHub — Everything your school needs, in one place.',
  description: 'School management platform',
}