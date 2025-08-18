import { 
  type User, type InsertUser,
  type Division, type InsertDivision,
  type Worker, type InsertWorker,
  type Client, type InsertClient,
  type InventoryItem, type InsertInventoryItem,
  type RentalContract, type InsertRentalContract,
  type Job, type InsertJob,
  type Notification, type InsertNotification
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Divisions
  getDivisions(): Promise<Division[]>;
  getDivision(id: string): Promise<Division | undefined>;
  createDivision(division: InsertDivision): Promise<Division>;

  // Workers
  getWorkers(): Promise<Worker[]>;
  getWorker(id: string): Promise<Worker | undefined>;
  getWorkersByDivision(divisionId: string): Promise<Worker[]>;
  createWorker(worker: InsertWorker): Promise<Worker>;
  updateWorker(id: string, worker: Partial<InsertWorker>): Promise<Worker>;
  deleteWorker(id: string): Promise<boolean>;

  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: string): Promise<boolean>;

  // Inventory Items
  getInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  getInventoryItemsByType(type: string): Promise<InventoryItem[]>;
  getInventoryItemsByDivision(divisionId: string): Promise<InventoryItem[]>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: string): Promise<boolean>;

  // Rental Contracts
  getRentalContracts(): Promise<RentalContract[]>;
  getRentalContract(id: string): Promise<RentalContract | undefined>;
  getActiveRentalContracts(): Promise<RentalContract[]>;
  getExpiringContracts(days: number): Promise<RentalContract[]>;
  createRentalContract(contract: InsertRentalContract): Promise<RentalContract>;
  updateRentalContract(id: string, contract: Partial<InsertRentalContract>): Promise<RentalContract>;
  deleteRentalContract(id: string): Promise<boolean>;

  // Jobs
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  getJobsByWorker(workerId: string): Promise<Job[]>;
  getJobsByDivision(divisionId: string): Promise<Job[]>;
  getJobsByStatus(status: string): Promise<Job[]>;
  getJobsByDateRange(startDate: Date, endDate: Date): Promise<Job[]>;
  getTodaysJobs(): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job>;
  deleteJob(id: string): Promise<boolean>;

  // Notifications
  getNotifications(): Promise<Notification[]>;
  getNotification(id: string): Promise<Notification | undefined>;
  getUnreadNotifications(): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<boolean>;
  deleteNotification(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private divisions: Map<string, Division> = new Map();
  private workers: Map<string, Worker> = new Map();
  private clients: Map<string, Client> = new Map();
  private inventoryItems: Map<string, InventoryItem> = new Map();
  private rentalContracts: Map<string, RentalContract> = new Map();
  private jobs: Map<string, Job> = new Map();
  private notifications: Map<string, Notification> = new Map();

  constructor() {
    this.initializeData();
  }

  private initializeData() {
    // Create divisions
    const pestControlDivision: Division = {
      id: "div-1",
      name: "Pest Control",
      colorCode: "#22c55e",
      description: "Professional pest control services"
    };

    const hygieneDivision: Division = {
      id: "div-2", 
      name: "Hygiene Services",
      colorCode: "#f97316",
      description: "Commercial hygiene and sanitization services"
    };

    this.divisions.set(pestControlDivision.id, pestControlDivision);
    this.divisions.set(hygieneDivision.id, hygieneDivision);

    // Create sample workers
    const workers = [
      { name: "John Smith", email: "john@terminators.co.za", phone: "+27 41 123 4567", divisionId: "div-1" },
      { name: "Sarah Williams", email: "sarah@terminators.co.za", phone: "+27 41 123 4568", divisionId: "div-2" },
      { name: "David Brown", email: "david@terminators.co.za", phone: "+27 41 123 4569", divisionId: "div-1" },
      { name: "Lisa Johnson", email: "lisa@terminators.co.za", phone: "+27 41 123 4570", divisionId: "div-2" },
      { name: "Mike Johnson", email: "mike@terminators.co.za", phone: "+27 41 123 4571", divisionId: "div-1" },
      { name: "Emma Davis", email: "emma@terminators.co.za", phone: "+27 41 123 4572", divisionId: "div-2" },
      { name: "James Wilson", email: "james@terminators.co.za", phone: "+27 41 123 4573", divisionId: "div-1" },
      { name: "Rachel Green", email: "rachel@terminators.co.za", phone: "+27 41 123 4574", divisionId: "div-2" }
    ];

    workers.forEach((worker, index) => {
      const w: Worker = {
        id: `worker-${index + 1}`,
        ...worker,
        isActive: true,
        createdAt: new Date()
      };
      this.workers.set(w.id, w);
    });

    // Create sample clients
    const clients = [
      { name: "Pick n Pay Greenacres", address: "Greenacres Shopping Centre, Port Elizabeth", phone: "+27 41 234 5678", email: "manager@pnp-greenacres.co.za" },
      { name: "Shoprite Checkers", address: "Walmer Park Shopping Centre, Port Elizabeth", phone: "+27 41 234 5679", email: "admin@shoprite.co.za" },
      { name: "Baywest Mall", address: "Baywest City, Port Elizabeth", phone: "+27 41 234 5680", email: "facilities@baywest.co.za" },
      { name: "Boardwalk Casino", address: "Marine Drive, Summerstrand, Port Elizabeth", phone: "+27 41 234 5681", email: "maintenance@boardwalk.co.za" }
    ];

    clients.forEach((client, index) => {
      const c: Client = {
        id: `client-${index + 1}`,
        ...client,
        createdAt: new Date()
      };
      this.clients.set(c.id, c);
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Divisions
  async getDivisions(): Promise<Division[]> {
    return Array.from(this.divisions.values());
  }

  async getDivision(id: string): Promise<Division | undefined> {
    return this.divisions.get(id);
  }

  async createDivision(insertDivision: InsertDivision): Promise<Division> {
    const id = randomUUID();
    const division: Division = { ...insertDivision, id };
    this.divisions.set(id, division);
    return division;
  }

  // Workers
  async getWorkers(): Promise<Worker[]> {
    return Array.from(this.workers.values());
  }

  async getWorker(id: string): Promise<Worker | undefined> {
    return this.workers.get(id);
  }

  async getWorkersByDivision(divisionId: string): Promise<Worker[]> {
    return Array.from(this.workers.values()).filter(worker => worker.divisionId === divisionId);
  }

  async createWorker(insertWorker: InsertWorker): Promise<Worker> {
    const id = randomUUID();
    const worker: Worker = { ...insertWorker, id, createdAt: new Date() };
    this.workers.set(id, worker);
    return worker;
  }

  async updateWorker(id: string, updateData: Partial<InsertWorker>): Promise<Worker> {
    const worker = this.workers.get(id);
    if (!worker) throw new Error("Worker not found");
    
    const updatedWorker = { ...worker, ...updateData };
    this.workers.set(id, updatedWorker);
    return updatedWorker;
  }

  async deleteWorker(id: string): Promise<boolean> {
    return this.workers.delete(id);
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return Array.from(this.clients.values());
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const client: Client = { ...insertClient, id, createdAt: new Date() };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client> {
    const client = this.clients.get(id);
    if (!client) throw new Error("Client not found");
    
    const updatedClient = { ...client, ...updateData };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  // Inventory Items
  async getInventoryItems(): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values());
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    return this.inventoryItems.get(id);
  }

  async getInventoryItemsByType(type: string): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values()).filter(item => item.type === type);
  }

  async getInventoryItemsByDivision(divisionId: string): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values()).filter(item => item.divisionId === divisionId);
  }

  async createInventoryItem(insertItem: InsertInventoryItem): Promise<InventoryItem> {
    const id = randomUUID();
    const item: InventoryItem = { ...insertItem, id, createdAt: new Date() };
    this.inventoryItems.set(id, item);
    return item;
  }

  async updateInventoryItem(id: string, updateData: Partial<InsertInventoryItem>): Promise<InventoryItem> {
    const item = this.inventoryItems.get(id);
    if (!item) throw new Error("Inventory item not found");
    
    const updatedItem = { ...item, ...updateData };
    this.inventoryItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    return this.inventoryItems.delete(id);
  }

  // Rental Contracts
  async getRentalContracts(): Promise<RentalContract[]> {
    return Array.from(this.rentalContracts.values());
  }

  async getRentalContract(id: string): Promise<RentalContract | undefined> {
    return this.rentalContracts.get(id);
  }

  async getActiveRentalContracts(): Promise<RentalContract[]> {
    return Array.from(this.rentalContracts.values()).filter(contract => contract.isActive);
  }

  async getExpiringContracts(days: number): Promise<RentalContract[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);
    
    return Array.from(this.rentalContracts.values()).filter(contract => 
      contract.isActive && 
      contract.endDate && 
      new Date(contract.endDate) <= cutoffDate
    );
  }

  async createRentalContract(insertContract: InsertRentalContract): Promise<RentalContract> {
    const id = randomUUID();
    const contract: RentalContract = { ...insertContract, id, createdAt: new Date() };
    this.rentalContracts.set(id, contract);
    return contract;
  }

  async updateRentalContract(id: string, updateData: Partial<InsertRentalContract>): Promise<RentalContract> {
    const contract = this.rentalContracts.get(id);
    if (!contract) throw new Error("Rental contract not found");
    
    const updatedContract = { ...contract, ...updateData };
    this.rentalContracts.set(id, updatedContract);
    return updatedContract;
  }

  async deleteRentalContract(id: string): Promise<boolean> {
    return this.rentalContracts.delete(id);
  }

  // Jobs
  async getJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values());
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async getJobsByWorker(workerId: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.workerId === workerId);
  }

  async getJobsByDivision(divisionId: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.divisionId === divisionId);
  }

  async getJobsByStatus(status: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  async getJobsByDateRange(startDate: Date, endDate: Date): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => {
      const jobDate = new Date(job.scheduledDate);
      return jobDate >= startDate && jobDate <= endDate;
    });
  }

  async getTodaysJobs(): Promise<Job[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.getJobsByDateRange(today, tomorrow);
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const now = new Date();
    const job: Job = { 
      ...insertJob, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.jobs.set(id, job);
    return job;
  }

  async updateJob(id: string, updateData: Partial<InsertJob>): Promise<Job> {
    const job = this.jobs.get(id);
    if (!job) throw new Error("Job not found");
    
    const updatedJob = { ...job, ...updateData, updatedAt: new Date() };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async deleteJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    return Array.from(this.notifications.values());
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async getUnreadNotifications(): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(notification => !notification.isRead);
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = { ...insertNotification, id, createdAt: new Date() };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const notification = this.notifications.get(id);
    if (!notification) return false;
    
    notification.isRead = true;
    this.notifications.set(id, notification);
    return true;
  }

  async deleteNotification(id: string): Promise<boolean> {
    return this.notifications.delete(id);
  }
}

export const storage = new MemStorage();
