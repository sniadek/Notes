# Task tracker (Plane, self-hosted)

This runs [Plane](https://github.com/makeplane/plane) as a standalone Docker service, pinned to its official community self-host `docker-compose.yaml` (pulled from `deployments/cli/community/` upstream; the original upstream README is kept alongside as [PLANE_UPSTREAM_README.md](PLANE_UPSTREAM_README.md) for reference).

It's decoupled from the Tauri/React Notes app in `app/` — no shared code or build step. The Notes app just links out to whatever URL this is running on.

## Start it

```sh
cd tracker
docker compose up -d
```

First boot pulls several images and runs DB migrations — give it a minute, then check status:

```sh
docker compose ps
```

Open **http://localhost:8080** and complete the first-run admin/workspace setup.

(Ports are set to `8080`/`8443` instead of Plane's default `80`/`443` in [.env](.env) to avoid clashing with anything else already bound to those ports. Change `LISTEN_HTTP_PORT` there if you want a different port.)

## Relabel "Issue" → "Task"

Plane's default work item type is called "Issue." To make it read like a general task tracker instead of a bug tracker:

1. Open a project → **Settings → Work item types** (or **Features**, depending on Plane version).
2. Rename the default type from "Issue" to "Task" (icon/description optional).

This is a UI-config change in Plane's own settings — no code or compose changes needed.

## Stop it

```sh
cd tracker
docker compose down       # keep data
docker compose down -v    # also wipe volumes (destroys all tracker data)
```
