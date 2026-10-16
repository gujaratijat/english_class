const SUPABASE_URL = 'https://fixnefvoznegothpmehu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeG5lZnZvem5lZ290aHBtZWh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwOTU0MzQsImV4cCI6MjEwNzY3MTQzNH0.zjydOx0wP9KFY1KiP2iaNiis_rGQ-bLPGKleUsXIiFI';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);