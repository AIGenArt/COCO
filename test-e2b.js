// Simple E2B API test
const E2B_API_KEY = 'e2b_0d65ade39a4fd12c1f08e734a3959d13c1298e23';

async function testE2B() {
  console.log('Testing E2B API...');
  console.log('API Key:', E2B_API_KEY.substring(0, 10) + '...');
  
  try {
    // Test 1: Check if API key format is correct
    if (!E2B_API_KEY.startsWith('e2b_')) {
      throw new Error('Invalid API key format - should start with e2b_');
    }
    console.log('✓ API key format is correct');
    
    // Test 2: Try to list sandboxes (this will fail if key is invalid)
    const response = await fetch('https://api.e2b.dev/sandboxes', {
      headers: {
        'X-API-Key': E2B_API_KEY,
      },
    });
    
    console.log('Response status:', response.status);
    
    if (response.status === 401) {
      console.error('✗ API key is INVALID or EXPIRED');
      console.error('Get a new key from: https://e2b.dev/dashboard');
      return false;
    }
    
    if (response.status === 403) {
      console.error('✗ API key is valid but QUOTA EXCEEDED');
      console.error('Check your usage at: https://e2b.dev/dashboard');
      return false;
    }
    
    if (!response.ok) {
      const error = await response.text();
      console.error('✗ API error:', error);
      return false;
    }
    
    const data = await response.json();
    console.log('✓ API key is VALID');
    console.log('Active sandboxes:', data.length || 0);
    
    return true;
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return false;
  }
}

testE2B().then(success => {
  process.exit(success ? 0 : 1);
});
