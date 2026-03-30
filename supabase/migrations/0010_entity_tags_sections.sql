-- Normalize legacy tag categories to the new campaign-wide sections.
update public.entity_tags
set tag_type = 'inventory'
where tag_type = 'item';

update public.entity_tags
set tag_type = 'pet'
where tag_type = 'location';

alter table public.entity_tags
drop constraint if exists entity_tags_tag_type_check;

alter table public.entity_tags
add constraint entity_tags_tag_type_check
check (tag_type in ('npc', 'inventory', 'pet'));
