alter table public.community_stories
  drop constraint if exists community_stories_content_length_check;
alter table public.community_stories
  add constraint community_stories_content_length_check
  check (char_length(content) between 40 and 1600) not valid;
