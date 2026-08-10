# Despliegue en AWS Academy Learner Lab

Guía para levantar ALUMCO completo (frontend + backend + MySQL) en **una sola instancia EC2**
usando Docker Compose, dentro de un AWS Academy Learner Lab.

## Particularidades del Learner Lab a tener en cuenta

- No se pueden crear usuarios/roles IAM propios: solo existe un rol ya provisto
  (normalmente `LabInstanceProfile` / `voclabs-role-...`). Hay que asociarlo a la EC2 al
  lanzarla para que el backend pueda hablar con S3 sin credenciales estáticas.
- Las credenciales temporales que te da el lab (Access Key/Secret/Session Token) expiran
  cada pocas horas. Por eso en `server/.env` **no** se ponen `AWS_ACCESS_KEY_ID` /
  `AWS_SECRET_ACCESS_KEY` — el SDK las toma solas del instance profile de la EC2, que se
  renueva automáticamente mientras la instancia esté corriendo dentro de una sesión del lab.
- Región normalmente fija en `us-east-1` (verificar arriba a la derecha en la consola).
- Al terminar la sesión del lab ("End Lab") la instancia EC2 se **detiene**, no se borra —
  los datos del volumen EBS (y por lo tanto de MySQL y los uploads) persisten entre
  sesiones. Lo que sí puede cambiar es la IP pública si no asignaste una IP elástica.

## 1. Iniciar el lab y crear el bucket S3

1. En el curso de AWS Academy, abrí el módulo del Learner Lab y hacé clic en **Start Lab**.
   Esperá el círculo verde y luego clic en **AWS** (arriba a la izquierda) para entrar a la consola.
2. Andá a **S3** → **Create bucket**.
   - Nombre único, ej. `alumco-<algo-random>`.
   - Región: la misma que uses para la EC2 (ej. `us-east-1`).
   - **Object Ownership**: elegí **ACLs enabled → Bucket owner preferred** (el código actual
     sube archivos con `ACL: public-read`; con "ACLs disabled", que es el default nuevo de
     AWS, esas subidas fallarían).
   - Dejá **Block all public access** desactivado para los objetos (el bucket sirve
     certificados y videos públicamente vía URL firmada/pública). Si el lab no te deja
     desmarcarlo, avisame y lo resolvemos usando solo URLs firmadas.
3. Anotá el nombre del bucket y la región — van en `AWS_S3_BUCKET_NAME` y
   `AWS_DEFAULT_REGION` del `.env` del backend.

## 2. Lanzar la instancia EC2

**EC2 → Launch instance**

- **Nombre**: `alumco-server`
- **AMI**: Ubuntu Server 24.04 LTS (evitar versiones más nuevas: el repo oficial de Docker
  puede no tener aún paquetes para codenames muy recientes)
- **Instance type**: `t3.small` si el lab lo permite (2 GB RAM da margen corriendo MySQL +
  Node + Nginx). Si solo hay `t2.micro`/`t3.micro` (1 GB), también funciona pero con menos
  margen — evitá build de Vite en la instancia (lo hacemos en tu máquina, ver paso 4).
- **Key pair**: creá una nueva (`.pem`), descargala y guardala — sin ella no hay SSH.
- **Network settings**:
  - Security group nuevo, permitir:
    - SSH (22) — restringido a "My IP"
    - HTTP (80) — Anywhere (0.0.0.0/0)
- **Configure storage**: subí a 20 GB gp3 (el default de 8 GB queda justo con imágenes Docker + MySQL).
- **Advanced details** → **IAM instance profile**: seleccioná el rol del lab
  (`LabInstanceProfile` o el que aparezca — es el único disponible). **Este paso es el que
  le da acceso a S3 sin credenciales estáticas.**
- Launch instance.

### IP elástica (recomendado)

Para no perder la IP pública cada vez que cerrás y reabrís el lab:
**EC2 → Elastic IPs → Allocate Elastic IP address** → luego **Associate** con la instancia.

## 3. Conectarse por SSH

```bash
chmod 400 alumco-server.pem
ssh -i alumco-server.pem ubuntu@<IP_PUBLICA>
```

## 4. Instalar Docker en la instancia

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Cerrá y volvé a abrir la sesión SSH para que el usuario `ubuntu` pueda usar `docker` sin `sudo`.

## 5. Build del frontend (en tu máquina local, no en la EC2)

En instancias chicas conviene no correr el build de Vite ahí. Se hace local y se sube el
resultado ya compilado:

```bash
cd client
npm install
npm run build
```

Esto genera `client/dist/`. No hace falta definir `VITE_API_URL`: Nginx sirve el frontend y
el backend en el mismo origen, así que el cliente usa rutas relativas (`/api`) y no hay
problemas de CORS.

## 6. Subir el proyecto a la EC2

Desde tu máquina, en la raíz del repo (esto incluye `client/dist` recién generado):

```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'server/uploads' \
  --exclude 'server/data' --exclude '.claude' \
  -e "ssh -i alumco-server.pem" ./ ubuntu@<IP_PUBLICA>:~/alumco
```

## 7. Configurar las variables de entorno en la EC2

Por SSH, ya dentro de `~/alumco`:

```bash
cp .env.example .env
nano .env    # completar DB_NAME / DB_USER / DB_PASSWORD / DB_ROOT_PASSWORD

cp server/.env.production.example server/.env
nano server/.env   # completar JWT_SECRET, RESEND_API_KEY, claves de IA, Google OAuth,
                    # AWS_S3_BUCKET_NAME, AWS_DEFAULT_REGION, CLIENT_URL con la IP/dominio real.
                    # Dejar AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY vacíos.
```

Los valores de `RESEND_API_KEY`, `GEMINI_API_KEY`/`ANTHROPIC_API_KEY`/`OPENROUTER_API_KEY`,
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` pueden copiarse tal cual del `.env` que usaban en
Railway. Lo único que cambia es `CLIENT_URL`, `GOOGLE_REDIRECT_URI` (nueva IP/dominio) y todo
el bloque de `AWS_*` (bucket nuevo en tu cuenta AWS en vez del object storage de Railway).

No te olvides de actualizar el **Authorized redirect URI** en Google Cloud Console con la
nueva URL (`http://<IP_O_DOMINIO>/api/google/callback`).

## 8. Levantar todo

```bash
cd ~/alumco
docker compose up -d --build
docker compose ps          # los 3 servicios deberían quedar "healthy"/"running"
```

## 9. Correr migraciones y (opcional) seed

```bash
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:seed   # solo si querés datos de ejemplo
```

## 10. Verificar

```bash
curl http://localhost/api/health
```

Y desde el navegador: `http://<IP_PUBLICA>/`.

## Reiniciar tras cerrar y reabrir el lab

Docker Compose ya tiene `restart: unless-stopped` en los 3 servicios, así que al reiniciar
la EC2 los contenedores vuelven a levantar solos apenas arranca el daemon de Docker. Solo
hace falta:

```bash
sudo systemctl enable docker   # una sola vez, para que Docker arranque solo al bootear
```

Si la IP pública cambió (no asignaste IP elástica), actualizá `CLIENT_URL` y
`GOOGLE_REDIRECT_URI` en `server/.env` y corré `docker compose up -d` de nuevo para que el
backend tome los nuevos valores.

## Logs / debugging

```bash
docker compose logs -f backend
docker compose logs -f db
docker compose logs -f nginx
```
