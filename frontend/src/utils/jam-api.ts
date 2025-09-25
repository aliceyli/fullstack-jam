import axios from "axios";

export interface ICompany {
  id: number;
  company_name: string;
  liked: boolean;
}

export interface ICollection {
  id: string;
  collection_name: string;
  companies: ICompany[];
  total: number;
}

export interface ICompanyBatchResponse {
  companies: ICompany[];
}

export interface IMoveCompaniesRequest {
  company_ids: number[];
  from_collection_id: string;
  to_collection_id: string;
}
export interface IMoveCompaniesResponse {
  moved_count: number;
  message: string;
}

export interface IBulkMoveRequest {
  from_collection_id: string;
  to_collection_id: string;
  company_ids?: number[]; // Optional - if empty/undefined, move all companies
}
export interface IBulkMoveResponse {
  operation_id: string;
  batch_task_ids: string[];
  total_batches: number;
  status: string;
}

export interface IBulkMoveStatusResponse {
    operation_id: string;
    total_batches: number;
    completed_batches: number;
    failed_batches: number;
    progress_percentage: number;
    status: string
}

const BASE_URL = "http://localhost:8000";

export async function getCompanies(
  offset?: number,
  limit?: number
): Promise<ICompanyBatchResponse> {
  try {
    const response = await axios.get(`${BASE_URL}/companies`, {
      params: {
        offset,
        limit,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching companies:", error);
    throw error;
  }
}

export async function getCollectionsById(
  id: string,
  offset?: number,
  limit?: number
): Promise<ICollection> {
  try {
    const response = await axios.get(`${BASE_URL}/collections/${id}`, {
      params: {
        offset,
        limit,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching companies:", error);
    throw error;
  }
}

export async function getCollectionsMetadata(): Promise<ICollection[]> {
  try {
    const response = await axios.get(`${BASE_URL}/collections`);
    return response.data;
  } catch (error) {
    console.error("Error fetching companies:", error);
    throw error;
  }
}

export async function moveCompaniesToCollections(
  reqData: IMoveCompaniesRequest
): Promise<IMoveCompaniesResponse> {
  try {
    const response = await axios.post(
      `${BASE_URL}/collections/move-companies`,
      reqData
    );
    return response.data;
  } catch (error) {
    console.error("Error with move: ", error);
    throw error;
  }
}

export async function moveAllCompaniesToCollections(
  reqData: IBulkMoveRequest
) : Promise<IBulkMoveResponse> {
  try {    
    const response = await axios.post(
      `${BASE_URL}/collections/bulk-move`,
      reqData
    );
    return response.data;
  } catch (error) {
    console.error("Error with bulk move: ", error);
    throw error;
  }
}

export async function getBulkMoveStatus(
  operationId : string
) : Promise<IBulkMoveStatusResponse> {
  try {
    const response = await axios.get(
      `${BASE_URL}/collections/bulk-move-status/${operationId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error getting bulk move status ", error);
    throw error;
  }
}