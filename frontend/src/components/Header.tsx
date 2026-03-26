import Image from "next/image";

export function Header() {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-lg shadow-lg mb-8">
      <div className="flex items-center gap-4">
        <Image
          src="https://upload.wikimedia.org/wikipedia/commons/2/21/CNPq_logo.png"
          alt="CNPq"
          width={60}
          height={60}
          className="object-contain"
        />
        <div>
          <h1 className="text-3xl font-bold mb-2">Lattes Automator AI</h1>
          <p className="text-blue-100">
            Automação e resumo de currículos Lattes
          </p>
        </div>
      </div>
    </div>
  );
}
