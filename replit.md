# The Terminators Field Service Management System

## Overview

The Terminators is a field service management system designed for pest control and hygiene services companies. The application manages job scheduling, worker assignments, inventory tracking, rental contracts, and reporting for two main divisions: Pest Control and Hygiene Services. Built as a full-stack web application, it provides real-time dashboards, mobile-responsive interfaces, and comprehensive business management tools for field service operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing with clean URL structure
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent design
- **Styling**: Tailwind CSS with custom design tokens for division-specific branding (pest control green, hygiene orange)
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Form Handling**: React Hook Form with Zod validation for type-safe form processing
- **Mobile Support**: Responsive design with dedicated mobile navigation component

### Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript with ES modules for modern JavaScript features
- **API Design**: RESTful API with resource-based endpoints following standard HTTP conventions
- **Request Handling**: Express middleware for JSON parsing, request logging, and error handling
- **Development Setup**: Vite integration for hot module replacement in development mode

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema Design**: Normalized relational structure with separate tables for users, divisions, workers, clients, inventory, jobs, contracts, and notifications
- **Database Provider**: Neon Database (serverless PostgreSQL) for cloud hosting
- **Migration Management**: Drizzle Kit for schema migrations and database versioning
- **Connection Pooling**: Built-in connection pooling through Neon's serverless driver

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL storage using connect-pg-simple
- **User System**: Basic user authentication with username/password credentials
- **Authorization**: Role-based access control (currently admin-level access)

### External Dependencies
- **Database Hosting**: Neon Database for managed PostgreSQL hosting
- **UI Framework**: Radix UI for accessible component primitives
- **Validation**: Zod for runtime type checking and schema validation
- **Date Handling**: date-fns for date manipulation and formatting
- **Icons**: Lucide React for consistent iconography
- **Development Tools**: Replit integration for cloud development environment
- **Accounting Integration**: Sage Business Cloud Accounting API for financial data synchronization

### Key Design Patterns
- **Component Composition**: Reusable UI components with consistent prop interfaces
- **Type Safety**: End-to-end TypeScript with shared schemas between client and server
- **Separation of Concerns**: Clear separation between UI components, business logic, and data access
- **Error Boundaries**: Centralized error handling with user-friendly error messages
- **Responsive Design**: Mobile-first approach with progressive enhancement for larger screens
- **Real-time Updates**: Polling-based data refresh for dashboard metrics and notifications

### Division-Specific Features - Updated to Match Business Website
Based on terminators.co.za, the system now accurately reflects the actual business services:

- **Pest Control Services** (div-1): Green branding (#22c55e), professional pest control and extermination services for residential and commercial clients
- **Sanitary Bin Services** (div-2): Purple branding (#8b5cf6), sanitary waste collection, disposal and feminine hygiene services with A/B teams
- **Washroom Services** (div-3): Blue branding (#3b82f6), complete washroom maintenance, hygiene and supply services

**Recent Changes (August 20, 2025)**:
- **Navigation Reorganization**: Complete restructuring of application navigation into four business categories
  - 📊 **Sales**: Clients, Rental Contracts, Email Center
  - 🔧 **Service**: Calendar, Job Scheduling, Field Workers, Stock Management, Suppliers, Purchase Orders
  - 💰 **Finance**: Invoices
  - ⚙️ **Admin**: Reports
- **Calendar Implementation**: Full Microsoft Outlook-style calendar with multiple view types
  - Month, Week, Day, and Agenda views
  - Job integration with automatic event generation from scheduled jobs
  - Event filtering by division, status, and search
  - Event details popup with job information
  - Mobile-responsive calendar interface
- **Terminology Updates**: Changed "Inventory" to "Stock Management" throughout application
- **Mobile Navigation**: Updated mobile menu to reflect new categorization structure
- Removed non-core divisions (Hygiene Services, Ablution Deep Cleaning, Daily Cleaning Services)
- Consolidated all washroom-related services under single Washroom Services division
- Redistributed 24 staff members across the three core service divisions
- Updated all inventory items to reflect correct division assignments
- Multi-tenant Support: Division-based filtering and assignment of workers, jobs, and inventory across the three core divisions
- Staff role updates: Sheryl-Lyn Lee promoted to Sales Administrator, Chane du Toit added as Sales Representative
- Enhanced reports with individual staff performance tracking including job counts and sales figures
- **MAJOR FEATURE: Sage Accounting Integration** - Implemented comprehensive Sage Business Cloud Accounting API integration for invoice export with OAuth 2.0 authentication, automatic contact creation, and invoice synchronization

### Real Staff Integration
- Actual organizational structure from The Terminators organogram integrated
- Real staff names, roles, and division assignments
- Team supervisors and management hierarchy properly structured
- 24 staff members across all divisions with authentic contact details
- Individual staff performance reporting with date range filtering and sales calculations