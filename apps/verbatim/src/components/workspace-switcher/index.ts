/**
 * Workspace Switcher Components
 *
 * A dropdown menu for switching between workspaces in the Pilot UI.
 */

export { WorkspaceSwitcher } from './WorkspaceSwitcher';
export { CreateWorkspaceModal, type CreatedWorkspace } from './CreateWorkspaceModal';
export {
  useActiveWorkspace,
  getActiveWorkspaceFromStorage,
  setActiveWorkspaceInStorage,
  LS_WORKSPACE_ID,
  LS_WORKSPACE_NAME,
  WORKSPACE_CHANGE_EVENT,
  type ActiveWorkspace,
  type UseActiveWorkspaceReturn,
} from './useActiveWorkspace';
