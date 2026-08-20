import { AuthService } from './auth-service';

async function createDefaultAdmin() {
  try {
    const { ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    if (!ADMIN_USERNAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be set to create an administrator.');
    }

    console.log('Creating administrator user...');
    
    const adminUser = await AuthService.createAdminUser({
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'superadmin',
      password: ADMIN_PASSWORD,
    });

    console.log('Administrator user created successfully.');
    console.log('Username:', ADMIN_USERNAME);
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