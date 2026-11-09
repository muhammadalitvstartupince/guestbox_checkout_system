-- Update skin accent color from cyan to blue to match GuestBox branding
UPDATE skins
SET config = jsonb_set(config, '{colors,accent}', '"#0284c7"')
WHERE config->'colors'->>'accent' = '#00b4d8';
