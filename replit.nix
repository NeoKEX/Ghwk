{ pkgs }: {
  deps = [
    pkgs.dbus
    pkgs.alsa-lib
    pkgs.expat
    pkgs.libxkbcommon
    pkgs.libdrm
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.atk
    pkgs.nspr
    pkgs.mesa
    pkgs.cairo
    pkgs.pango
    pkgs.gtk3
    pkgs.nss
    pkgs.glib
    pkgs.chromium
    pkgs.bashInteractive
    pkgs.nodePackages.bash-language-server
    pkgs.man
  ];
}