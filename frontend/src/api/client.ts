import useStore from '../store/useStore';
import { API_BASE_URL } from '../config';

const BASE_URL = API_BASE_URL;

// Helper to get headers with auth token
const getHeaders = () => {
    const token = useStore.getState().token;
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

// Helper to handle responses and auto-logout on 401
const handleResponse = async (response: Response) => {
    if (response.status === 401) {
        useStore.getState().logout();
        throw new Error('Session expired, please login again');
    }
    if (!response.ok) {
        // Try to parse error message from backend
        try {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'API Error');
        } catch (e) {
            throw new Error(response.statusText || 'API Error');
        }
    }
    return response.json();
};

export interface User {
    id: number;
    username: string;
    email?: string;
    created_at: string;
}

export interface Project {
    id: number;
    name: string;
    description?: string;
    data: string | object; // JSON string or object (since we upgraded to JSONB)
    created_at: string;
    updated_at: string;
    user_id: number;
}

export interface ProjectCreate {
    name: string;
    description?: string;
    data: object;
}

export interface ProjectUpdate {
    name?: string;
    description?: string;
    data?: object;
}

export const api = {
    // Auth
    async register(username: string, password: string, email?: string): Promise<User> {
        const response = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email }),
        });
        return handleResponse(response);
    },

    async login(username: string, password: string): Promise<{ access_token: string, token_type: string }> {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch(`${BASE_URL}/token`, {
            method: 'POST',
            body: formData,
        });
        return handleResponse(response);
    },

    async getCurrentUser(): Promise<User> {
        const response = await fetch(`${BASE_URL}/users/me`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },

    // Projects
    async getProjects(): Promise<Project[]> {
        const response = await fetch(`${BASE_URL}/projects/`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },

    async getProject(id: number): Promise<Project> {
        const response = await fetch(`${BASE_URL}/projects/${id}`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },

    async createProject(project: ProjectCreate): Promise<Project> {
        const response = await fetch(`${BASE_URL}/projects/`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(project),
        });
        return handleResponse(response);
    },

    async updateProject(id: number, project: ProjectUpdate): Promise<Project> {
        const response = await fetch(`${BASE_URL}/projects/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(project),
        });
        return handleResponse(response);
    },

    async deleteProject(id: number): Promise<void> {
        const response = await fetch(`${BASE_URL}/projects/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        return handleResponse(response);
    }
};
