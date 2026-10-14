-- Seed the "default" skin as data so it exists as soon as migrations run,
-- without depending on `prisma db seed` having been executed. Mirrors the
-- skin upsert in prisma/seed.ts — keep both in sync if the config changes.
INSERT INTO "skins" ("id", "slug", "name", "config")
VALUES (
    gen_random_uuid(),
    'default',
    'Default',
    '{
        "colors": {
            "primary": "#0d1b2a",
            "accent": "#ef9a1d",
            "success": "#28a745",
            "danger": "#ef4444"
        },
        "font": "Arial, sans-serif",
        "backgroundImageUrl": "/pages_Images/AdobeStock_415564278-1.jpeg",
        "logoUrl": "/pages_Images/newtvstartuplogocopy.png"
    }'::jsonb
)
ON CONFLICT ("slug") DO NOTHING;
