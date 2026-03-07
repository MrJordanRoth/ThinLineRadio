#!/usr/bin/env bash

# --- Variables & Colors ---
set -e
YW=$(echo "\033[33m")
GN=$(echo "\033[32m")
RD=$(echo "\033[31m")
BL=$(echo "\033[34m")
CL=$(echo "\033[m")

# --- UI Functions ---
function msg_info() { echo -e "${BL}[Info]${CL} $1"; }
function msg_ok() { echo -e "${GN}[OK]${CL} $1"; }
function msg_error() { echo -e "${RD}[Error]${CL} $1"; }

clear
cat << "EOF"
  _____ _     _       _      _              ____           _ _       
 |_   _| |__ (_)_ __ | |    (_)_ __   ___  |  _ \ __ _  __| (_) ___  
   | | | '_ \| | '_ \| |    | | '_ \ / _ \ | |_) / _` |/ _` | |/ _ \ 
   | | | | | | | | | | |___ | | | | |  __/ |  _ < (_| | (_| | | (_) |
   |_| |_| |_|_|_| |_|_____||_|_| |_|\___| |_| \_\__,_|\__,_|_|\___/ 
                                                                     
EOF

# 1. Welcome & Confirmation
whiptail --title "ThinLine Radio LXC Installer" --yesno "This script will create a new LXC for ThinLine Radio v7+. \n\nContinue?" 10 60 || exit

# 2. Gather User Input via Whiptail
CT_ID=$(whiptail --inputbox "Enter a unique Container ID" 8 60 "$(pvesh get /cluster/nextid)" --title "Container ID" 3>&1 1>&2 2>&3) || exit
CT_NAME=$(whiptail --inputbox "Enter a hostname" 8 60 "thinlineradio" --title "Hostname" 3>&1 1>&2 2>&3) || exit
DISK_SIZE=$(whiptail --inputbox "Enter disk size (GB)" 8 60 "8" --title "Disk Size" 3>&1 1>&2 2>&3) || exit
STORAGE=$(whiptail --inputbox "Enter storage name (e.g., local-lvm, ceph)" 8 60 "local-lvm" --title "Storage" 3>&1 1>&2 2>&3) || exit

# 3. Create the Container
msg_info "Creating LXC Container ${CT_ID} (${CT_NAME})..."
pct create $CT_ID local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname $CT_NAME \
  --cores 2 \
  --memory 2048 \
  --rootfs $STORAGE:$DISK_SIZE \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 \
  --features nesting=1 \
  --start 1

# 4. Run Installation inside the LXC
msg_info "Starting Application Installation (this may take a few minutes)..."

pct exec $CT_ID -- bash -c "
  apt-get update && apt-get install -y curl sudo ffmpeg postgresql wget mc
  
  # Setup PostgreSQL
  systemctl start postgresql
  sudo -u postgres psql -c \"CREATE DATABASE thinlineradio;\"
  
  # Download ThinLine Radio (Latest Beta)
  VERSION='v7.0.0-beta9.7.7'
  mkdir -p /opt/thinlineradio
  wget -q https://github.com/Thinline-Dynamic-Solutions/ThinLineRadio/releases/download/\$VERSION/thinline-radio-linux-amd64-\$VERSION.tar.gz
  tar -xvf thinline-radio-linux-amd64-\$VERSION.tar.gz -C /opt/thinlineradio
  rm thinline-radio-linux-amd64-\$VERSION.tar.gz
  chmod +x /opt/thinlineradio/thinline-radio

  # Create Systemd Service
  cat <<EOF_SVC > /etc/systemd/system/thinlineradio.service
[Unit]
Description=ThinLine Radio Server
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/thinlineradio
ExecStart=/opt/thinlineradio/thinline-radio
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF_SVC

  systemctl daemon-reload
  systemctl enable thinlineradio
"

IP_ADDR=$(pct exec $CT_ID -- hostname -I | awk '{print $1}')

whiptail --title "Installation Complete" --msgbox "ThinLine Radio is installed!\n\nAccess it at: http://$IP_ADDR:8080\n\nNOTE: You must 'pct enter $CT_ID' and run /opt/thinlineradio/thinline-radio manually once to finish the wizard." 12 70

msg_ok "ThinLine Radio is ready at http://$IP_ADDR:8080"
