import Link from "next/link";

export default function Step5() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center">
        <p className="text-sm text-gray-500 mb-4">Paso 5 de 8</p>
        <h1 className="text-4xl font-bold mb-6">Step 5</h1>
        <p className="text-gray-600 mb-8">Contenido del paso 5</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/step/4"
            className="inline-block border border-black text-black px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition"
          >
            ← Anterior
          </Link>
          <Link
            href="/step/6"
            className="inline-block bg-black text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-800 transition"
          >
            Siguiente →
          </Link>
        </div>
      </div>
    </main>
  );
}
