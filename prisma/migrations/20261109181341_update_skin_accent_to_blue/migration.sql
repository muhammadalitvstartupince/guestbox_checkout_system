-- Update skin accent color to blue to match GuestBox branding
UPDATE skins
SET config = jsonb_set(config, '{colors,accent}', '"#0284c7"')
WHERE config->'colors'->>'accent' IN ('#00b4d8', '#ef9a1d');
