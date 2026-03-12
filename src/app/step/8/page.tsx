import Link from "next/link";

export default function Step8() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center">
        <p className="text-sm text-gray-500 mb-4">Paso 8 de 8</p>
        <h1 className="text-4xl font-bold mb-6">Step 8</h1>
        <p className="text-gray-600 mb-8">Contenido del paso 8</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/step/7"
            className="inline-block border border-black text-black px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition"
          >
            ← Anterior
          </Link>
          <button
            className="inline-block bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700 transition"
          >
            Finalizar ✓
          </button>
        </div>
      </div>
    </main>
  );
}
