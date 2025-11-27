{
  description = "A Nix-based media management system";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    # Parte 1: Cosas que dependen del sistema (paquetes, shells)
    (flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        # Frontend Build
        frontend = pkgs.stdenv.mkDerivation {
          pname = "media-manager-frontend";
          version = "0.1.0";
          src = ./frontend/front;
          buildInputs = [ pkgs.nodejs ];
          NODE_PATH = "${pkgs.nodejs}/lib/node_modules";
          buildPhase = ''
            runHook preBuild
            npm install
            npm run build
            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall
            mkdir -p $out
            cp -R ./dist/* $out
            runHook postInstall
          '';
        };

        # Backend Build
        backend = pkgs.stdenv.mkDerivation {
          pname = "media-manager-backend";
          version = "0.1.0";
          src = ./backend;
          buildInputs = [ pkgs.nodejs pkgs.ffmpeg ];
          NODE_PATH = "${pkgs.nodejs}/lib/node_modules";
          buildPhase = ''
            runHook preBuild
            npm install
            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall
            mkdir -p $out/bin
            cp -R ./* $out/
            mkdir -p $out/public
            cp -R ${frontend}/* $out/public
            echo "node $out/src/index.js" > $out/bin/media-manager
            chmod +x $out/bin/media-manager
            runHook postInstall
          '';
        };

      in
      {
        packages.default = backend;

        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs
            pkgs.ffmpeg
          ];
        };
      }
    )) 
    # Parte 2: Cosas globales (Módulos de NixOS)
    # Usamos // para unir esto con lo de arriba
    // {
      nixosModules.default = { config, lib, pkgs, ... }:
        with lib;
        let
          cfg = config.services.media-manager;
          # Referenciamos el paquete que definimos arriba dinámicamente
          backendPackage = self.packages.${pkgs.system}.default;
        in
        {
          options.services.media-manager = {
            enable = mkEnableOption "media-manager service";
            port = mkOption {
              type = types.port;
              default = 3001;
              description = "Port for the media-manager web interface and API.";
            };
            dataDir = mkOption {
              type = types.path;
              default = "/var/lib/media-manager";
              description = "Data directory for the database and backups.";
            };
            watchDir = mkOption {
              type = types.path;
              description = "Directory to watch for new media files (e.g., SD card mount point).";
            };
          };

          config = mkIf cfg.enable {
            systemd.services.media-manager = {
              description = "Media Manager Backend Service";
              after = [ "network.target" ];
              wantedBy = [ "multi-user.target" ];
              serviceConfig = {
                User = "media-manager";
                Group = "media-manager";
                
                Environment = [
                  "NODE_ENV=production"
                  "PORT=${toString cfg.port}"
                  "DB_PATH=${cfg.dataDir}/metadata.db"
                  "BACKUP_DIR=${cfg.dataDir}/backups"
                  "WATCH_DIR=${cfg.watchDir}"
                ];

                StateDirectory = "media-manager";
                StateDirectoryMode = "0750";

                # Aquí está el cambio clave: usamos backendPackage
                ExecStart = "${backendPackage}/bin/media-manager";
                WorkingDirectory = "${backendPackage}";
                Restart = "on-failure";
              };
            };

            users.users.media-manager = {
              isSystemUser = true;
              group = "media-manager";
            };
            users.groups.media-manager = {};
          };
        };
    };
}