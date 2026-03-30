"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search, UserRoundSearch } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
    defaultValues: { nome: lastSearchTerm ?? "" },
  });

  useEffect(() => {
    form.setValue("nome", lastSearchTerm ?? "", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [form, lastSearchTerm]);

  const handleSearch = form.handleSubmit(async (values) => {
    await onSearch(values.nome);
  });

  return (
    <Card variant="panel">
      <CardHeader className="space-y-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
          <UserRoundSearch className="h-3.5 w-3.5" />
          Busca por nome
        </div>
        <div>
          <CardTitle className="text-xl text-slate-950">
            Encontre o currículo de uma pessoa
          </CardTitle>
          <CardDescription>
            Digite o nome, escolha a opção correta e depois prepare o currículo
            em PDF para leitura.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form className="space-y-3" onSubmit={handleSearch}>
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da pessoa</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex.: Neocles Alves Pereira"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button className="w-full sm:w-auto" disabled={isSearching} type="submit">
              <Search className="h-4 w-4" />
              {isSearching ? "Buscando..." : "Buscar"}
            </Button>
          </form>
        </Form>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Pessoas encontradas</p>
              <p className="text-sm text-slate-500">
                {lastSearchTerm
                  ? `Ultima busca: ${lastSearchTerm}`
                  : "Faça uma busca para ver as opções disponíveis."}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {candidates.length} opção(ões)
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
              Depois da busca, as opções encontradas aparecerão aqui.
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
            {isScraping ? "Preparando currículo..." : "Preparar currículo em PDF"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}