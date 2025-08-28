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

### Division-Specific Features - Updated to Match Actual Departments
Based on current business operations, the system now accurately reflects the four main service departments:

- **Pest Control** (div-1): Green branding (#22c55e), professional pest control and extermination services for residential and commercial clients
- **Sanitary Bins** (div-2): Purple branding (#8b5cf6), sanitary waste collection, disposal and feminine hygiene services with A/B teams
- **Washroom** (div-3): Blue branding (#3b82f6), complete washroom maintenance, hygiene and supply services
- **Deep Cleaning** (div-4): Orange branding (#f59e0b), professional deep cleaning and specialized cleaning services

**Recent Changes (August 28, 2025)**:
- **Calendar Hour View Toggle**: Added toggle between Business Hours (7AM-5PM) and Full Day (24 Hours) views for day calendar
- **Calendar Height Fix**: Fixed month view calendar container height to prevent bottom row cutoff, changed from fixed height to scrollable
- **Department Selection in Appointments**: Added department dropdown to Create Appointment form for proper categorization

**Previous Changes (August 27, 2025)**:
- **Landscape Daily Department Schedule Cards**: Implemented printable daily job schedules optimized for A4 landscape format
  - Compact table layout displaying one department per day with horizontal job listings
  - 8-column structure: Job#, Time, Job & Client, Worker, Location, Status, Notes
  - Print-optimized CSS with reduced margins (0.3in) and font sizes for single-page printing
  - Accessible from Calendar page via "Print Daily Schedule" button with department and date selection
  - API endpoint `/api/jobs/daily/:divisionId/:date` for fetching division-specific daily jobs
  - Prevents table row breaks across pages for clean printing

**Previous Changes (August 21, 2025)**:
- **Complete Customer Workflow Testing**: Validated entire business process from customer creation through service completion to invoice generation
- **Critical API Date Fixes**: Applied comprehensive date string-to-Date object conversion across job creation, job updates, and invoice creation routes
- **Enhanced Error Handling**: Added detailed validation error messages with specific field information for troubleshooting
- **CSV Invoice Export for Sage**: Implemented alternative Sage integration method allowing manual CSV export and import
  - New "Export for Sage" button on Invoices page downloads Sage-compatible CSV format
  - Includes all essential invoice data: numbers, client details, dates, amounts, status, notes
  - Provides immediate Sage integration without requiring API credentials
- **Navigation Reorganization**: Complete restructuring of application navigation into four business categories
  - 📊 **Sales**: Clients, Rental Contracts, Email Center
  - 🔧 **Service**: Calendar, Job Scheduling, Field Workers, Stock Management, Suppliers, Purchase Orders
  - 💰 **Finance**: Invoices
  - ⚙️ **Admin**: Reports
- **Calendar Implementation**: Full Microsoft Outlook-style calendar with multiple view types
- **Terminology Updates**: Changed "Inventory" to "Stock Management" throughout application
- **MAJOR FEATURE: Sage Accounting Integration** - Implemented comprehensive Sage Business Cloud Accounting API integration for invoice export with OAuth 2.0 authentication, automatic contact creation, and invoice synchronization
- **Division System Cleanup**: Fixed duplicate division creation issues in mobile test data script

### Real Staff Integration
- Actual organizational structure from The Terminators organogram integrated
- Real staff names, roles, and division assignments
- Team supervisors and management hierarchy properly structured
- 24 staff members across all divisions with authentic contact details
- Individual staff performance reporting with date range filtering and sales calculations