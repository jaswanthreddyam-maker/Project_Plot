from backend.main import app
routes = sorted([r.path for r in app.routes])
for r in routes:
    print(r)
