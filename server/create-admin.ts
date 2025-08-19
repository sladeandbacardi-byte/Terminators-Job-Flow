import { AuthService } from './auth-service';

async function createDefaultAdmin() {
  try {
    console.log('Creating default admin user...');
    
    const adminUser = await AuthService.createAdminUser({
      username: 'admin',
      email: 'admin@terminators.co.za',
      firstName: 'System',
      lastName: 'Administrator',
      role: 'superadmin',
      password: 'TerminatorsAdmin2024!',
    });

    console.log('✅ Default admin user created successfully!');
    console.log('Username: admin');
    console.log('Password: TerminatorsAdmin2024!');
    console.log('Email:', adminUser.email);
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) {
      console.log('ℹ️  Admin user already exists');
    } else {
      console.error('❌ Error creating admin user:', error);
    }
  }
}

// Run the function immediately
createDefaultAdmin().then(() => process.exit(0));

export { createDefaultAdmin };