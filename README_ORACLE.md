# Oracle Free VPS Deployment

This runs AniFlex and Miruro on one Oracle Cloud Always Free VM with Docker Compose.

## 1. Create the Oracle VM

Use an Ubuntu image. If available, choose an Always Free Ampere A1 shape. A small AMD Always Free VM can work, but builds may be slow.

Open inbound TCP port `80` in the Oracle VCN security list for the subnet.

## 2. Install Docker on the VM

SSH into the server, then run:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and SSH back in so the Docker group change applies.

## 3. Deploy AniFlex

```bash
git clone https://github.com/miksss1412/AniFlex.git
cd AniFlex
```

Create a local Docker Compose env file. Use your server IP first; replace it with your domain later if you add DNS.

```bash
cat > .env <<'EOF'
MIRURO_REQUEST_ORIGIN=http://YOUR_SERVER_IP
MIRURO_REQUEST_TIMEOUT_MS=12000
EOF
```

Start the app:

```bash
docker compose up -d --build
```

Open:

```text
http://YOUR_SERVER_IP
```

## Useful Commands

View logs:

```bash
docker compose logs -f
```

Restart:

```bash
docker compose restart
```

Update after pushing new Git changes:

```bash
git pull
docker compose up -d --build
```

Stop:

```bash
docker compose down
```

## Notes

Miruro is private inside Docker at `http://miruro:8000`. Only AniFlex is exposed publicly on port `80`.

If you use a domain later, update `.env`:

```bash
MIRURO_REQUEST_ORIGIN=https://your-domain.com
```

Then rebuild:

```bash
docker compose up -d --build
```
