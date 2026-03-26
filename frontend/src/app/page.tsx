import { Header } from "@/components/Header";
import { IndividualSearch } from "@/components/IndividualSearch";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Header />
        <IndividualSearch />
      </div>
    </div>
  );
}
