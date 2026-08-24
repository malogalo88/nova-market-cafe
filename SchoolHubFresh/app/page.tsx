export default function HomePage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-4xl font-bold mb-6">
        SchoolHub
      </h1>
      <p className="text-lg text-muted-foreground">
        Everything your school needs, in one place.
      </p>
      <div className="mt-8 max-w-md">
        <a href="/login" className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-md font-medium hover:bg-indigo-500 transition-colors">
          Login
        </a>
      </div>
    </div>
  )
}