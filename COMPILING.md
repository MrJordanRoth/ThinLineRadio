# How to compile

> THINLINE RADIO IS BASED ON [RDIO SCANNER](https://github.com/chuot/rdio-scanner). WHEN THE ORIGINAL PROJECT STAGNATED, WE OFFERED TO COLLABORATE AND HELP MAINTAIN IT. THAT OFFER WAS DECLINED. THINLINE RADIO IS NOW AN INDEPENDENT PROJECT IN ITS OWN REPOSITORY THAT CONTINUES ACTIVE DEVELOPMENT. WE ACKNOWLEDGE THE ORIGINAL CODEBASE BUT DO NOT PROVIDE SUPPORT FOR RDIO SCANNER. FOR RDIO SCANNER SUPPORT, REFER TO THE ORIGINAL PROJECT.

Thinline Radio is compiled on a PC using the current version of Fedora Workstation. You should have no problem building on another platform as long as the prerequisites are available and installed.

## Install the prerequisites

Your os distribution may have all of the following prerequisites available in its own package repository. Make sure, however, that they are at the latest version. This is especially not the case with Ubuntu and its Node.js.

- latest version of git ([here](https://git-scm.com/downloads))
- latest version of gnu make ([here](https://www.gnu.org/software/make/))
- latest long-term support version of Node.js ([here](https://nodejs.org/en/))
- latest version of Go ([here](https://go.dev/dl/))
- latest version of Pandoc with pandoc-pdf ([here](https://pandoc.org/installing.html))
- latest version of TeX Live ([here](https://www.tug.org/texlive/))
- latest version of Info-Zip ([here](http://infozip.sourceforge.net/))
- latest version of podman ([here](https://podman.io/)), only for building containers

## Compile the app

Clone the repository on your computer and start the build process.

        git clone https://github.com/yourusername/Thinline-Radio.git
        cd Thinline-Radio
        make

When finished, you will find the precompiled versions for various platforms in the `dist` folder.

        thinline-radio-darwin-amd64-v7.0.0.zip
        thinline-radio-darwin-arm64-v7.0.0.zip
        thinline-radio-freebsd-amd64-v7.0.0.zip
        thinline-radio-linux-386-v7.0.0.zip
        thinline-radio-linux-amd64-v7.0.0.zip
        thinline-radio-linux-arm64-v7.0.0.zip
        thinline-radio-linux-arm-v7.0.0.zip
        thinline-radio-windows-amd64-v7.0.0.zip

**Happy scanning with Thinline Radio!**