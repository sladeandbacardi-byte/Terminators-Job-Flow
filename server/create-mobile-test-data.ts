import { storage } from "./storage";
import bcrypt from "bcryptjs";

// Create test data for mobile app testing
export async function createMobileTestData() {
  try {
    console.log("Creating mobile test data...");

    // Use existing Pest Control division (div-1) instead of creating a new one
    const divisionId = "div-1";

    // Create a test client
    const client = await storage.createClient({
      name: "ABC Restaurant",
      email: "manager@abcrestaurant.com",
      phone: "+27 11 123 4567",
      address: "123 Main Street, Johannesburg, 2001",
      contactPerson: "John Manager",
      businessType: "Restaurant",
      status: "active",
      departmentId: divisionId,
      paymentTerms: "30 days",
      notes: "Monthly pest control required"
    });

    // Create a test worker with mobile credentials
    const worker = await storage.createWorker({
      name: "Mike Johnson",
      email: "mike.johnson@terminators.co.za",
      phone: "+27 82 123 4567",
      departmentId: divisionId,
      role: "Field Technician",
      employeeId: "EMP001",
      pin: null,
      isActive: true
    });

    // Create some test jobs for the worker
    const job1 = await storage.createJob({
      title: "Monthly Pest Control Inspection",
      description: "Routine monthly pest control inspection and treatment",
      clientId: client.id,
      workerId: worker.id,
      departmentId: divisionId,
      serviceType: "Pest Control",
      status: "scheduled",
      scheduledDate: new Date(),
      scheduledTime: "09:00 AM",
      priority: "medium",
      estimatedDuration: 120,
      location: client.address || "",
      notes: "Check all entry points and bait stations"
    });

    const job2 = await storage.createJob({
      title: "Emergency Rodent Control",
      description: "Emergency call for rodent infestation in kitchen area",
      clientId: client.id,
      workerId: worker.id,
      departmentId: divisionId,
      serviceType: "Rodent Control",
      status: "in_progress",
      scheduledDate: new Date(),
      scheduledTime: "02:00 PM",
      priority: "high",
      estimatedDuration: 90,
      location: client.address || "",
      notes: "Focus on kitchen and storage areas"
    });

    console.log("Mobile test data created successfully:");
    console.log(`Worker: ${worker.name} (Employee ID: ${worker.employeeId})`);
    console.log(`Client: ${client.name}`);
    console.log(`Jobs created: ${job1.title}, ${job2.title}`);
    
    return {
      worker,
      client,
      jobs: [job1, job2],
    };
  } catch (error) {
    console.error("Error creating mobile test data:", error);
    throw error;
  }
}