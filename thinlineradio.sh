#!/usr/bin/env bash

# --- Configuration & Versioning ---
VERSION="v7.0.0-beta9.7.7" 
APP_PATH="/opt/thinlineradio"
SERVICE_NAME="thinlineradio"

# --- Visual Setup ---
set -e
YW=$(echo "\033[33m")
GN=$(echo "\033[32m")
RD=$(echo "\033[31m")
BL=$(echo "\033[34m")
CL=$(echo "\033[m")

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

# --- Main Menu ---
MENU_CHOICE=$(whiptail --title "ThinLine Radio Manager" --menu "Select an action:" 15 60 4 \
"1" "Create New LXC & Install" \
"2" "Upgrade Existing LXC Binary" \
"3" "Check Status / Logs" \
"4" "Exit" 3>&1 1>&2 2>&3) || exit

case $MENU_CHOICE in
  1)
    # --- STEP 1: GATHER INFO ---
    CT_ID=$(whiptail --inputbox "Enter a unique Container ID" 8 60 "$(pvesh get /cluster/nextid)" --title "Container ID" 3>&1 1>&2 2>&3) || exit
    CT_NAME=$(whiptail --inputbox "Enter a hostname" 8 60 "thinlineradio" --title "Hostname" 3>&1 1>&2 2>&3) || exit
    DISK_SIZE=$(whiptail --inputbox "Enter disk size (GB)" 8 60 "8" --title "Disk Size" 3>&1 1>&2 2>&3) || exit
    STORAGE=$(whiptail --inputbox "Enter storage name (e.g., local-lvm)" 8 60 "local-lvm" --title "Storage" 3>&1 1>&2 2>&3) || exit

    # --- STEP 2: CREATE CONTAINER ---
    msg_info "Creating LXC Container ${CT_ID}..."
    pct create $CT_ID local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
      --hostname $CT_NAME \
      --cores 2 \
      --memory 2048 \
      --rootfs $STORAGE:$DISK_SIZE \
      --net0 name=eth0,bridge=vmbr0,ip=dhcp \
      --unprivileged 1 \
      --features nesting=1 \
      --start 1

    # --- STEP 3: INSTALL INSIDE LXC ---
    msg_info "Configuring OS and Database..."
    pct exec $CT_ID -- bash -c "
      apt-get update && apt-get install -y curl sudo ffmpeg postgresql wget mc
      systemctl start postgresql
      # Wait for PGSQL to spin up
      sleep 2
      sudo -u postgres psql -c \"CREATE DATABASE thinlineradio;\" || true
      
      mkdir -p $APP_PATH
      wget -q https://github.com/Thinline-Dynamic-Solutions/ThinLineRadio/releases/download/$VERSION/thinline-radio-linux-amd64-$VERSION.tar.gz
      tar -xvf thinline-radio-linux-amd64-$VERSION.tar.gz -C $APP_PATH --strip-components=1
      rm thinline-radio-linux-amd64-$VERSION.tar.gz
      chmod +x $APP_PATH/thinline-radio

      cat <<EOF_SVC > /etc/systemd/system/$SERVICE_NAME.service
[Unit]
Description=ThinLine Radio Server
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=$APP_PATH
ExecStart=$APP_PATH/thinline-radio
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF_SVC

      systemctl daemon-reload
      systemctl enable $SERVICE_NAME
    "
    
    IP_ADDR=$(pct exec $CT_ID -- hostname -I | awk '{print $1}')
    whiptail --title "Success" --msgbox "Installed at http://$IP_ADDR:8080\n\nRun 'pct enter $CT_ID' then '$APP_PATH/thinline-radio' for first-run setup." 12 70
    ;;

  2)
    # --- UPGRADE LOGIC ---
    CT_ID=$(whiptail --inputbox "Enter the ID of the LXC to upgrade:" 8 60 "" --title "Upgrade ID" 3>&1 1>&2 2>&3) || exit
    
    msg_info "Upgrading ThinLine Radio to $VERSION..."
    pct exec $CT_ID -- bash -c "
      systemctl stop $SERVICE_NAME
      cd $APP_PATH
      # Backup old binary just in case
      [ -f thinline-radio ] && mv thinline-radio thinline-radio.bak
      
      wget -q https://github.com/Thinline-Dynamic-Solutions/ThinLineRadio/releases/download/$VERSION/thinline-radio-linux-amd64-$VERSION.tar.gz
      tar -xvf thinline-radio-linux-amd64-$VERSION.tar.gz -C $APP_PATH --strip-components=1
      rm thinline-radio-linux-amd64-$VERSION.tar.gz
      chmod +x thinline-radio
      systemctl start $SERVICE_NAME
    "
    msg_ok "Upgrade to $VERSION finished."
    ;;

  3)
    # --- STATUS CHECK ---
    CT_ID=$(whiptail --inputbox "Enter LXC ID to check status:" 8 60 "" --title "Status Check" 3>&1 1>&2 2>&3) || exit
    echo -e "${YW}--- Service Status ---${CL}"
    pct exec $CT_ID -- systemctl status $SERVICE_NAME --no-pager
    echo -e "${YW}--- Recent Logs ---${CL}"
    pct exec $CT_ID -- tail -n 20 /var/log/syslog | grep thinline || true
    ;;

  *)
    exit
    ;;
esac
