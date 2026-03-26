export interface ScrapeRequest {
  nome: string;
  provedor: string;
  modelo: string;
  api_key?: string;
  headless?: boolean;
}

export interface ScrapeResponse {
  nome: string;
  dados?: {
    resumo: string;
    vinculo_institucional: string;
    graduacao?: string;
    mestrado?: string;
    doutorado?: string;
    pos_doutorado?: string;
  };
  docx_path?: string;
  erro?: string;
}

export interface BatchScrapeRequest {
  nomes: string[];
  provedor: string;
  modelo: string;
  api_key?: string;
  headless?: boolean;
}
