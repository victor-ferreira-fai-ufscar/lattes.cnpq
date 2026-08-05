import type { ReactNode } from "react";
import { BookOpen, ExternalLink, Newspaper, Quote } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PerfilExterno } from "@/features/lattes/services/lattes.service";

type PerfilExternoCardProps = {
  perfil?: PerfilExterno | null;
  /** Usa a variante compacta, sem moldura própria, dentro de outro card. */
  embedded?: boolean;
};

const FONTE_LABELS: Record<string, string> = {
  openalex: "OpenAlex",
  "google-news": "Google News",
};

function formatarData(valor: string | null) {
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString("pt-BR");
}

function formatarNumero(valor: number) {
  return valor.toLocaleString("pt-BR");
}

export function PerfilExternoCard({
  perfil,
  embedded = false,
}: PerfilExternoCardProps) {
  // A API já filtra por confiança; a checagem aqui evita renderizar um bloco
  // vazio caso o backend passe a enviar perfis de confiança menor.
  if (!perfil || perfil.confianca !== "alta") {
    return null;
  }

  const fontes = perfil.fontes.map((fonte) => FONTE_LABELS[fonte] ?? fonte);
  const criterios = perfil.criterios.join("; ");

  const conteudo = (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile
          icon={<BookOpen className="size-4" aria-hidden />}
          label="Obras registradas"
          value={formatarNumero(perfil.total_obras)}
        />
        <MetricTile
          icon={<Quote className="size-4" aria-hidden />}
          label="Citações"
          value={formatarNumero(perfil.total_citacoes)}
        />
        <MetricTile
          icon={<Newspaper className="size-4" aria-hidden />}
          label="h-index"
          value={perfil.h_index === null ? "—" : formatarNumero(perfil.h_index)}
        />
      </div>

      {perfil.afiliacao ? (
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-800">Afiliação:</span>{" "}
          {perfil.afiliacao}
        </p>
      ) : null}

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-800">
          Obras mais citadas
        </h4>
        {perfil.obras.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma obra recuperada nas fontes externas.
          </p>
        ) : (
          <ul className="space-y-2">
            {perfil.obras.map((obra) => (
              <li
                key={obra.url ?? obra.doi ?? obra.titulo}
                className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm"
              >
                <p className="font-medium text-slate-800">{obra.titulo}</p>
                <p className="text-xs text-slate-500">
                  {[
                    obra.ano ? String(obra.ano) : null,
                    obra.veiculo,
                    obra.citacoes
                      ? `${formatarNumero(obra.citacoes)} citações`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {obra.doi ? (
                  <a
                    href={obra.doi}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline"
                  >
                    DOI <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-800">
          Notícias e menções
        </h4>
        {perfil.noticias.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma notícia identificada com confiança.
          </p>
        ) : (
          <ul className="space-y-2">
            {perfil.noticias.map((noticia) => (
              <li
                key={noticia.url}
                className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm"
              >
                <a
                  href={noticia.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-1 font-medium text-cyan-700 hover:underline"
                >
                  {noticia.titulo}
                  <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
                </a>
                <p className="text-xs text-slate-500">
                  {[noticia.veiculo, formatarData(noticia.data)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Coletado automaticamente em {fontes.join(", ") || "fonte não informada"}.
        Confira antes de divulgar.
      </p>
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3 rounded-lg border border-cyan-200/70 bg-cyan-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-cyan-950">
            Produção e presença pública
          </h3>
          <ConfiancaBadge criterios={criterios} />
        </div>
        {conteudo}
      </div>
    );
  }

  return (
    <Card variant="infoSubtle">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg text-cyan-950">
            Produção e presença pública
          </CardTitle>
          <ConfiancaBadge criterios={criterios} />
        </div>
        <CardDescription>
          Dados de fontes externas ao Lattes, usados para complementar o
          currículo.
        </CardDescription>
      </CardHeader>
      <CardContent>{conteudo}</CardContent>
    </Card>
  );
}

function ConfiancaBadge({ criterios }: { criterios: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
          Identificação confiável
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">
        {criterios
          ? `Confirmado por: ${criterios}.`
          : "Identificação confirmada pelas fontes externas."}
      </TooltipContent>
    </Tooltip>
  );
}

type MetricTileProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function MetricTile({ icon, label, value }: MetricTileProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
