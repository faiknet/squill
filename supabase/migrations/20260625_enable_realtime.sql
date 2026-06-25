-- Enable Realtime for session_activity_logs and entity_tags
alter publication supabase_realtime add table session_activity_logs;
alter publication supabase_realtime add table entity_tags;
