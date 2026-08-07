{
  description = "lattes.cnpq — toolchain de desenvolvimento";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

  outputs = { self, nixpkgs }:
    let
      forAllSystems = f:
        nixpkgs.lib.genAttrs [ "x86_64-linux" "aarch64-linux" ]
          (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [
            pkgs.python312
            pkgs.uv
            pkgs.nodejs_22
            pkgs.pnpm
          ];

          # O uv baixa um Python próprio da internet por padrão, o que anula
          # metade do isolamento. Aqui ele usa o Python do Nix e nada mais.
          env = {
            UV_PYTHON = "${pkgs.python312}/bin/python3.12";
            UV_PYTHON_DOWNLOADS = "never";

            # Wheels binários do PyPI (greenlet, via playwright) linkam contra
            # libstdc++ do sistema, que o Python do Nix não enxerga.
            # ponytail: só libstdc++ porque só ela quebrou. Se um wheel novo
            # pedir outra lib, acrescente aqui — nix-ld só se virar rotina.
            LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib ];
          };

          # ponytail: o Nix pina só o toolchain — uv.lock e pnpm-lock já pinam
          # as dependências de cada linguagem. Empacotar as libs Python no Nix
          # é reescrever o uv.lock à mão; se precisar de build reproduzível pra
          # deploy, o caminho é pyproject-nix/uv2nix, não expandir este arquivo.
          shellHook = ''
            echo "lattes.cnpq — python $(python3 --version | cut -d' ' -f2), node $(node -v), uv $(uv --version | cut -d' ' -f2)"
          '';
        };
      });
    };
}
