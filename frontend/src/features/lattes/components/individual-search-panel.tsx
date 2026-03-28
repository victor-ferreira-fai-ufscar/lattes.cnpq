"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search, UserRoundSearch } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IndividualSearchSchema,
  type IndividualSearchFormData,
} from "@/features/lattes/schemas/lattes.schemas";
import { cn } from "@/lib/utils";
import type { SearchCandidate } from "@/features/lattes/services/lattes.service";

type IndividualSearchPanelProps = {
  candidates: SearchCandidate[];
  selectedCandidate: SearchCandidate | null;
  lastSearchTerm: string | null;
  isSearching: boolean;
  isScraping: boolean;
  onSearch: (nome: string) => Promise<void>;
  onSelectCandidate: (candidate: SearchCandidate) => void;
  onScrape: () => Promise<void>;
};

export function IndividualSearchPanel({
  candidates,
  selectedCandidate,
  lastSearchTerm,
  isSearching,
  isScraping,
  onSearch,
  onSelectCandidate,
  onScrape,
}: IndividualSearchPanelProps) {
  const form = useForm<IndividualSearchFormData>({
    resolver: zodResolver(IndividualSearchSchema),
    defaultValues: { nome: "" },
  });

  const handleSearch = form.handleSubmit(async (values) => {
    await onSearch(values.nome);
  });

  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
      <CardHeader className="space-y-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
          <UserRoundSearch className="h-3.5 w-3.5" />
          Fluxo individual
        </div>
        <div>
          <CardTitle className="text-xl text-slate-950">
            Buscar e selecionar currículo
          </CardTitle>
          <CardDescription>
            A busca fica isolada na feature de Lattes. A página só compõe os
            módulos e delega as interações para o hook da feature.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-3" onSubmit={handleSearch}>
          <div className="space-y-2">
            <Label htmlFor="individual-search-name">Nome do docente</Label>
            <Input
              id="individual-search-name"
              placeholder="Ex.: Neocles Alves Pereira"
              {...form.register("nome")}
            />
            {form.formState.errors.nome ? (
              <p className="text-sm font-medium text-red-600">
                {form.formState.errors.nome.message}
              </p>
            ) : null}
          </div>
          <Button className="w-full sm:w-auto" disabled={isSearching} type="submit">
            <Search className="h-4 w-4" />
            {isSearching ? "Buscando..." : "Buscar candidatos"}
          </Button>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Resultados</p>
              <p className="text-sm text-slate-500">
                {lastSearchTerm
                  ? `Busca atual: ${lastSearchTerm}`
                  : "Nenhuma busca executada ainda."}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {candidates.length} candidato(s)
            </span>
          </div>

          {candidates.length > 0 ? (
            <div className="grid gap-2">
              {candidates.map((candidate) => {
                const isActive = selectedCandidate?.href === candidate.href;
                return (
                  <button
                    key={candidate.href}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left transition",
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-slate-50/70 text-slate-900 hover:border-slate-300 hover:bg-white",
                    )}
                    onClick={() => onSelectCandidate(candidate)}
                    type="button"
                  >
                    <p className="font-medium">{candidate.nome}</p>
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        isActive ? "text-slate-300" : "text-slate-500",
                      )}
                    >
                      {candidate.href}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
              Execute uma busca para listar os possíveis currículos.
            </div>
          )}

          <Button
            className="w-full"
            disabled={!selectedCandidate || isScraping}
            size="lg"
            type="button"
            onClick={() => {
              void onScrape();
            }}
          >
            {isScraping ? "Processando currículo..." : "Fazer scraping do selecionado"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}