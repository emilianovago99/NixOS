{
  description = "A Nix-based media management system";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
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
          
          # We need to manually set the NODE_PATH for npm to find packages
          # when building in the Nix sandbox.
          NODE_PATH = "${pkgs.nodejs}/lib/node_modules";

          buildPhase = ''
            runHook preBuild
            
            # Use the npm that's in the PATH
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
            
            # Copy built frontend into the public dir of the backend
            mkdir -p $out/public
            cp -R ${frontend}/* $out/public
            
            # A little script to run the server
            echo "node $out/src/index.js" > $out/bin/media-manager
            chmod +x $out/bin/media-manager

            runHook postInstall
          '';
        };

      in
      {
        # The final package accessible via `nix build`
        packages.default = backend;

        # NixOS Module for the service
        nixosModules.default = { config, lib, ... }:
          with lib;
          let
            cfg = config.services.media-manager;
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
                  
                  # Set environment variables for the node app
                  Environment = [
                    "NODE_ENV=production"
                    "PORT=${toString cfg.port}"
                    "DB_PATH=${cfg.dataDir}/metadata.db"
                    "BACKUP_DIR=${cfg.dataDir}/backups"
                    "WATCH_DIR=${cfg.watchDir}"
                  ];

                  # Create directories with correct permissions
                  StateDirectory = "media-manager";
                  StateDirectoryMode = "0750";

                  ExecStart = "${backend}/bin/media-manager";
                  WorkingDirectory = "${backend}";
                  Restart = "on-failure";
                };
              };

              # Create user and group for the service
              users.users.media-manager = {
                isSystemUser = true;
                group = "media-manager";
              };
              users.groups.media-manager = {};
            };
          };

        # Development Shell accessible via `nix develop`
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs
            pkgs.ffmpeg
          ];
        };
      });
}
