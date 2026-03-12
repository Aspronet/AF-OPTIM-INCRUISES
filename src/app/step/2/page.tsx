"use client";

import Link from "next/link";
export default function Step2() {
  // No stage change here — lead is still in Fase 1: Captación (watching VSL)

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      {/* Header / Logo */}
      <header className="flex justify-center py-6">
        <div className="flex items-center gap-2 text-xl font-bold">
          <span className="text-yellow-500 text-2xl">⭐</span>
          <span>
            EMPRENDEDOR<span className="font-light">DIGITAL</span>
          </span>
        </div>
      </header>

      {/* Content */}
      <section className="flex-1 flex flex-col items-center px-4 pb-16">
        <div className="max-w-3xl w-full text-center">
          {/* Headline */}
          <h1 className="text-2xl md:text-4xl font-bold leading-tight mb-8">
            Descubre Cómo Estamos Ayudando A Personas Como TÚ, A Ganar $10,000*
            USD Mensuales Convirtiéndote En Un Vendedor Digital Certificado En
            Tan Solo 60 Días
          </h1>

          {/* PASO 1 Badge */}
          <div className="inline-block bg-red-600 text-white font-bold text-sm md:text-base px-6 py-2 rounded mb-6">
            PASO 1: MIRA EL VIDEO
          </div>

          {/* Video Embed */}
          <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden mb-8">
            {/* Placeholder - reemplazar con el video real */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/30 transition">
                <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-1" />
              </div>
            </div>
            {/* Para usar un iframe de YouTube/Vimeo, reemplazar el div anterior con:
            <iframe
              src="URL_DEL_VIDEO"
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen"
              allowFullScreen
            /> */}
          </div>

          {/* PASO 2 Badge */}
          <div className="inline-block bg-red-600 text-white font-bold text-sm md:text-base px-6 py-2 rounded mb-6">
            PASO 2: APLICA AHORA
          </div>

          {/* CTA Button */}
          <Link
            href="/step/3"
            className="block max-w-2xl mx-auto bg-red-600 hover:bg-red-700 transition rounded-lg py-5 px-8 text-center"
          >
            <span className="text-xl md:text-2xl font-bold block">
              APLICA PARA UNA CONSULTORÍA GRATUITA
            </span>
            <span className="text-sm text-red-200 block mt-1">
              Hay disponibilidad SUPER LIMITADA...
            </span>
          </Link>
        </div>
      </section>

      {/* Footer / Disclaimers */}
      <footer className="bg-gray-950 border-t border-gray-800 px-4 py-8 text-sm text-gray-400 leading-relaxed">
        <div className="max-w-4xl mx-auto space-y-4">
          <p>
            Este sitio no es parte de los sitios web de Facebook o Instagram.
            Adicionalmente, este sitio NO esta respaldado por Facebook o
            Instagram de alguna manera. FACEBOOK es una marca registrada de
            Meta, Inc.
          </p>
          <p>
            Digital Entrepreneur LLC y este entrenamiento y oportunidad no esta
            afiliado con ni esta respaldado por Instagram.
          </p>
          <p className="font-semibold text-gray-300">
            IMPORTANTE: Disclaimers legales y de ganancias
          </p>
          <p>
            * Las ganancias y representaciones de ingresos hechas por Digital
            Entrepreneur LLC y sus promotores/patrocinadores/miembros/dueños son
            exclusivamente de uso aspiracional para tu potencial de ingresos. El
            éxito de Digital Entrepreneur LLC, los testimonios y otros ejemplos
            usados no son comunes y no estan hechos para ser, ni son una garantía
            de que tu u otras personas van a lograr los mismos resultados. Los
            resultados de cada individuo siempre van a variar y van a depender de
            tu capacidad individual, ética laboral, habilidades de negocio,
            experiencia, nivel de motivación, diligencia en aplicar los programas
            de Digital Entrepreneur LLC, la economía, los riesgos normales e
            imprevistos de hacer negocios, y otros factores.
          </p>
          <p>
            Digital Entrepreneur LLC no es responsable de tus acciones. Eres el
            único responsable de tus propias acciones y decisiones y la
            evaluación y uso de nuestros productos y servicios se debe basar en
            tu propia diligencia. Aceptas que Digital Entrepreneur LLC no es
            responsable de tus resultados al usar nuestros productos y servicios.
            Revisa nuestros Términos & Condiciones para nuestro disclaimer
            completo de responsabilidad y otras restricciones.
          </p>
          <p>
            ¿Tienes preguntas sobre cualquiera de los programas de Digital
            Entrepreneur LLC? ¿Te estas preguntando si los programas van a
            funcionar para ti? Envíanos un email a info@emprendedordigital.co y
            estaremos felices de discutir tus objetivos y mostrarte como nuestros
            programas podrían ayudarte.
          </p>
          <p>
            Dirección del negocio: 1309 Coffeen Ave Ste 1200 Sheridan, WY 82801
          </p>
          <div className="flex flex-wrap gap-2 text-blue-400">
            <a href="#" className="hover:underline">*Disclaimer de Ingresos</a>
            <span className="text-gray-600">|</span>
            <a href="#" className="hover:underline">Política de Privacidad</a>
            <span className="text-gray-600">|</span>
            <a href="#" className="hover:underline">Terminos de Servicio</a>
            <span className="text-gray-600">|</span>
            <a href="#" className="hover:underline">Política de Reembolsos</a>
          </div>
          <p className="text-center text-gray-500">
            © 2026 Digital Entrepreneur LLC - Todos los derechos reservados
          </p>
        </div>
      </footer>
    </main>
  );
}
