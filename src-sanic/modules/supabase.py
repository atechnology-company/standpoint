import os
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client

class SupabaseClient:
    """Supabase client wrapper for database operations"""
    
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_KEY")
        self.client = None
        
        if self.url and self.key:
            try:
                from supabase import create_client
                self.client = create_client(self.url, self.key)
            except ImportError:
                print("Supabase client not available. Install with: pip install supabase")
    
    def get_client(self):
        """Get the Supabase client instance"""
        return self.client
    
    def is_connected(self) -> bool:
        """Check if Supabase client is properly initialized"""
        return self.client is not None

# Global Supabase instance
supabase_client = SupabaseClient()