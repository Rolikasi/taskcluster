import React, { Component, Fragment } from 'react';
import { func, node } from 'prop-types';
import { withApollo } from 'react-apollo';
import { withRouter } from 'react-router-dom';
import { omit, pathOr } from 'ramda';
import { safeDump } from 'js-yaml';
import cloneDeep from 'lodash.clonedeep';
import List from '@material-ui/core/List';
import { withStyles } from '@material-ui/core/styles';
import ListItem from '@material-ui/core/ListItem';
import Typography from '@material-ui/core/Typography';
import Checkbox from '@material-ui/core/Checkbox';
import HammerIcon from 'mdi-react/HammerIcon';
import CreationIcon from 'mdi-react/CreationIcon';
import PencilIcon from 'mdi-react/PencilIcon';
import ClockOutlineIcon from 'mdi-react/ClockOutlineIcon';
import ShovelIcon from 'mdi-react/ShovelIcon';
import CloseIcon from 'mdi-react/CloseIcon';
import FlashIcon from 'mdi-react/FlashIcon';
import ConsoleLineIcon from 'mdi-react/ConsoleLineIcon';
import RestartIcon from 'mdi-react/RestartIcon';
import jsonSchemaDefaults from 'json-schema-defaults';
import SpeedDial from '../../../components/SpeedDial';
import SpeedDialAction from '../../../components/SpeedDialAction';
import DialogAction from '../../../components/DialogAction';
import Snackbar from '../../../components/Snackbar';
import TaskActionForm from '../../../components/TaskActionForm';
import formatError from '../../../utils/formatError';
import removeKeys from '../../../utils/removeKeys';
import parameterizeTask from '../../../utils/parameterizeTask';
import { nice } from '../../../utils/slugid';
import { TASK_ADDED_FIELDS, VALID_TASK } from '../../../utils/constants';
import formatTaskMutation from '../../../utils/formatTaskMutation';
import scheduleTaskQuery from './scheduleTask.graphql';
import rerunTaskQuery from './rerunTask.graphql';
import cancelTaskQuery from './cancelTask.graphql';
import purgeWorkerCacheQuery from './purgeWorkerCache.graphql';
import createTaskQuery from '../createTask.graphql';
import submitTaskAction from '../submitTaskAction';
import db from '../../../utils/db';
import { task } from '../../../utils/prop-types';

const updateTaskIdHistory = id => {
  if (!VALID_TASK.test(id)) {
    return;
  }

  db.taskIdsHistory.put({ taskId: id });
};

const taskInContext = (tagSetList, taskTags) =>
  tagSetList.some(tagSet =>
    Object.keys(tagSet).every(
      tag => taskTags[tag] && taskTags[tag] === tagSet[tag]
    )
  );
const getCachesFromTask = task =>
  Object.keys(pathOr({}, ['payload', 'cache'], task));

@withRouter
@withApollo
@withStyles({
  dialogListItem: {
    paddingTop: 0,
    paddingBottom: 0,
  },
})
export default class TaskActionButtons extends Component {
  static getDerivedStateFromProps(props, state) {
    const taskId = props.match.params.taskId || '';
    const { task } = props;
    const taskActions = [];
    const actionInputs = state.actionInputs || {};
    const actionData = state.actionData || {};

    if (taskId !== state.previousTaskId && task) {
      const { taskActions: actions } = task;

      updateTaskIdHistory(taskId);

      actions &&
        actions.actions.forEach(action => {
          const schema = action.schema || {};

          // if an action with this name has already been selected,
          // don't consider this version
          if (
            task &&
            task.tags &&
            taskInContext(action.context, task.tags) &&
            !taskActions.some(({ name }) => name === action.name)
          ) {
            taskActions.push(action);
          } else {
            return;
          }

          actionInputs[action.name] = safeDump(
            jsonSchemaDefaults(schema) || {}
          );
          actionData[action.name] = {
            action,
          };
        });
      const caches = getCachesFromTask(task);

      return {
        taskActions,
        actionInputs,
        actionData,
        previousTaskId: taskId,
        caches,
        selectedCaches: new Set(caches),
      };
    }

    return null;
  }

  static propTypes = {
    // The children prop can be used to add additional
    // action buttons in the speed dial.
    children: node,
    task,
    // A graphql function to refetch the task query.
    refetchTask: func,
  };

  static defaultProps = {
    children: null,
    task: null,
    refetchTask: null,
  };

  state = {
    taskActions: [],
    actionInputs: {},
    actionData: {},
    selectedAction: null,
    dialogOpen: false,
    actionLoading: false,
    dialogActionProps: null,
    dialogError: null,
    caches: null,
    selectedCaches: null,
    snackbar: {
      message: '',
      variant: 'success',
      open: false,
    },
    previousTaskId: null,
  };

  handleSnackbarOpen = ({ message, variant = 'success', open }) => {
    this.setState({ snackbar: { message, variant, open } });
  };

  handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    this.setState({
      snackbar: { message: '', variant: 'success', open: false },
    });
  };

  handleActionClick = name => () => {
    const { action } = this.state.actionData[name];

    this.setState({
      dialogError: null,
      dialogOpen: true,
      selectedAction: action,
    });
  };

  handleActionComplete = action => taskId => {
    this.handleActionDialogClose();
    this.handleActionTaskComplete(action, taskId);
  };

  handleActionDialogClose = () => {
    this.setState({
      dialogOpen: false,
      selectedAction: null,
      dialogActionProps: null,
      dialogError: null,
      actionLoading: false,
    });
  };

  handleDialogCompleteWithMessage = message => {
    this.handleActionDialogClose();
    this.handleSnackbarOpen({ message, open: true });
  };

  handleActionTaskComplete = (action, taskId) => {
    switch (action.name) {
      case 'create-interactive':
        this.props.history.push(`/tasks/${taskId}/connect`);
        break;
      default: {
        if (!this.props.match.params.logUrl) {
          this.handleDialogCompleteWithMessage(action.title);
        } else {
          this.props.history.push(`/tasks/${taskId}`);
        }
      }
    }
  };

  handleActionTaskSubmit = ({ name }) => async () => {
    this.preRunningAction();

    const { client, task } = this.props;
    const { actionInputs, actionData } = this.state;
    const form = actionInputs[name];
    const { action } = actionData[name];
    const taskId = await submitTaskAction({
      task,
      taskActions: task.taskActions,
      form,
      action,
      apolloClient: client,
    });

    return taskId;
  };

  // copy fields from the parent task, intentionally excluding some
  // fields which might cause confusion if left unchanged
  handleCloneTask = () => {
    const task = removeKeys(cloneDeep(this.props.task), ['__typename']);

    return omit(
      [
        ...TASK_ADDED_FIELDS,
        'routes',
        'taskGroupId',
        'schedulerId',
        'priority',
        'dependencies',
        'requires',
      ],
      task
    );
  };

  handleRerunComplete = taskId => {
    if (!this.props.match.params.logUrl) {
      this.handleDialogCompleteWithMessage('Rerun');
      this.props.refetchTask();
    } else {
      this.handleActionDialogClose();
      this.props.history.push(`/tasks/${taskId}`);
    }
  };

  handleCancelComplete = taskId => {
    if (!this.props.match.params.logUrl) {
      this.handleDialogCompleteWithMessage('Cancel');
      this.props.refetchTask();
    } else {
      this.handleActionDialogClose();
      this.props.history.push(`/tasks/${taskId}`);
    }
  };

  handleCreateInteractiveComplete = taskId => {
    this.handleActionDialogClose();
    this.props.history.push(`/tasks/${taskId}/connect`);
  };

  handleRetriggerComplete = taskId => {
    this.handleActionDialogClose();
    this.props.history.push(`/tasks/${taskId}`);
  };

  handleCreateInteractiveTaskClick = () => {
    const title = 'Create with SSH/VNC';

    this.setState({
      dialogOpen: true,
      dialogActionProps: {
        fullScreen: false,
        body: (
          <Fragment>
            <Typography variant="body2">
              This will duplicate the task and create it under a different{' '}
              <code>taskId</code>.
            </Typography>
            <Typography variant="body2">
              The new task will be altered to:
            </Typography>
            <ul>
              <li>
                <Typography variant="body2">
                  Set <code>task.payload.features.interactive = true</code>
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Strip <code>task.payload.caches</code> to avoid poisoning
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Ensures <code>task.payload.maxRunTime</code> is minimum of 60
                  minutes
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Strip <code>task.routes</code> to avoid side-effects
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Set the environment variable{' '}
                  <code>TASKCLUSTER_INTERACTIVE=true</code>
                </Typography>
              </li>
            </ul>
            <Typography variant="body2">
              Note: this may not work with all tasks. You may not have the
              scopes required to create the task.
            </Typography>
          </Fragment>
        ),
        title: `${title}?`,
        onSubmit: this.handleCreateLoaner,
        onComplete: this.handleCreateInteractiveComplete,
        confirmText: title,
      },
    });
  };

  handleCreateLoaner = async () => {
    const taskId = nice();
    const task = parameterizeTask(
      removeKeys(cloneDeep(this.props.task), ['__typename'])
    );

    this.preRunningAction();

    try {
      await this.props.client.mutate({
        mutation: createTaskQuery,
        variables: {
          taskId,
          task: formatTaskMutation(task),
        },
      });

      return taskId;
    } catch (error) {
      this.postRunningFailedAction(formatError(error));
      throw error;
    }
  };

  handleEdit = task =>
    this.props.history.push({
      pathname: '/tasks/create',
      state: { task },
    });

  handleEditTaskClick = () => {
    const title = 'Edit';

    this.setState({
      dialogOpen: true,
      dialogActionProps: {
        fullScreen: false,
        body: (
          <Typography variant="body2">
            Note that the edited task will not be linked to other tasks nor have
            the same <code>task.routes</code> as other tasks, so this is not a
            way to fix a failing task in a larger task group. Note that you may
            also not have the scopes required to create the resulting task.
          </Typography>
        ),
        title: `${title}?`,
        onSubmit: this.handleCloneTask,
        onComplete: this.handleEditTaskComplete,
        confirmText: title,
      },
    });
  };

  handleEditTaskComplete = task => {
    this.handleActionDialogClose();
    this.handleEdit(task);
  };

  handleFormChange = (value, name) =>
    this.setState({
      actionInputs: {
        // eslint-disable-next-line react/no-access-state-in-setstate
        ...this.state.actionInputs,
        [name]: value,
      },
    });

  handlePurgeWorkerCacheClick = () => {
    const title = 'Purge Worker Cache';
    const { selectedCaches } = this.state;

    this.setState({
      dialogOpen: true,
      dialogActionProps: {
        fullScreen: false,
        body: this.renderPurgeWorkerCacheDialogBody(selectedCaches),
        title: `${title}?`,
        onSubmit: this.purgeWorkerCache,
        onComplete: () => this.handleDialogCompleteWithMessage(title),
        confirmText: title,
      },
    });
  };

  handleCancelTaskClick = () => {
    const title = 'Cancel Task';

    this.setState({
      dialogOpen: true,
      dialogActionProps: {
        fullScreen: false,
        title: `${title}?`,
        onSubmit: this.cancelTask,
        onComplete: this.handleCancelComplete,
        confirmText: title,
      },
    });
  };

  handleRetriggerTaskClick = () => {
    const title = 'Retrigger';

    this.setState({
      dialogOpen: true,
      dialogActionProps: {
        fullScreen: false,
        body: (
          <Fragment>
            <Typography>
              This will duplicate the task and create it under a different{' '}
              <code>taskId</code>.
            </Typography>
            <Typography>
              The new task will be altered to:
              <ul>
                <li>
                  Update deadlines and other timestamps for the current time
                </li>
                <li>Strip self-dependencies from the task definition</li>
                <li>
                  Set number of <code>retries</code> to zero
                </li>
              </ul>
              <Typography>Note: this may not work with all tasks.</Typography>
            </Typography>
          </Fragment>
        ),
        title: `${title}?`,
        onSubmit: this.retriggerTask,
        onComplete: this.handleRetriggerComplete,
        confirmText: title,
      },
    });
  };

  handleRerunTaskClick = () => {
    const title = 'Rerun';

    this.setState({
      dialogOpen: true,
      dialogActionProps: {
        fullScreen: false,
        body: (
          <Typography variant="body2">
            This will cause a new run of the task to be created with the same{' '}
            <code>taskId</code>. It will only succeed if the task hasn&#39;t
            passed it&#39;s deadline. Notice that this may interfere with
            listeners who only expects this tasks to be resolved once.
          </Typography>
        ),
        title: `${title}?`,
        onSubmit: this.rerunTask,
        onComplete: this.handleRerunComplete,
        confirmText: title,
      },
    });
  };

  handleScheduleTaskClick = () => {
    const title = 'Schedule';

    this.setState({
      dialogOpen: true,
      dialogActionProps: {
        fullScreen: false,
        body: (
          <Typography variant="body2">
            This will <strong>overwrite any scheduling process</strong> taking
            place. If this task is part of a continuous integration process,
            scheduling this task may cause your commit to land with failing
            tests.
          </Typography>
        ),
        title: `${title}?`,
        onSubmit: this.scheduleTask,
        onComplete: () => this.handleDialogCompleteWithMessage(title),
        confirmText: title,
      },
    });
  };

  handleSelectCacheClick = cache => () => {
    // eslint-disable-next-line react/no-access-state-in-setstate
    const selectedCaches = new Set([...this.state.selectedCaches]);

    if (selectedCaches.has(cache)) {
      selectedCaches.delete(cache);
    } else {
      selectedCaches.add(cache);
    }

    this.setState({
      selectedCaches,
      dialogActionProps: {
        // eslint-disable-next-line react/no-access-state-in-setstate
        ...this.state.dialogActionProps,
        body: this.renderPurgeWorkerCacheDialogBody(selectedCaches),
      },
    });
  };

  handleTaskActionError = e => {
    this.setState({ dialogError: e, actionLoading: false });
  };

  postRunningFailedAction = error => {
    this.setState({ dialogError: error, actionLoading: false });
  };

  preRunningAction = () => {
    this.setState({ dialogError: null, actionLoading: true });
  };

  purgeWorkerCache = async () => {
    const { provisionerId, workerType } = this.props.task;
    const { selectedCaches } = this.state;

    this.preRunningAction();

    try {
      await Promise.all(
        [...selectedCaches].map(cacheName =>
          this.props.client.mutate({
            mutation: purgeWorkerCacheQuery,
            variables: {
              provisionerId,
              workerType,
              payload: {
                cacheName,
              },
            },
          })
        )
      );
    } catch (error) {
      this.postRunningFailedAction(error);
      throw error;
    }
  };

  rerunTask = async () => {
    const { taskId } = this.props.match.params;

    this.preRunningAction();

    try {
      await this.props.client.mutate({
        mutation: rerunTaskQuery,
        variables: {
          taskId,
        },
      });

      return taskId;
    } catch (error) {
      this.postRunningFailedAction(error);
      throw error;
    }
  };

  cancelTask = async () => {
    const { taskId } = this.props.match.params;

    this.preRunningAction();

    try {
      await this.props.client.mutate({
        mutation: cancelTaskQuery,
        variables: {
          taskId,
        },
      });

      return taskId;
    } catch (error) {
      this.postRunningFailedAction(error);
      throw error;
    }
  };

  scheduleTask = async () => {
    const { taskId } = this.props.match.params;

    this.preRunningAction();

    try {
      await this.props.client.mutate({
        mutation: scheduleTaskQuery,
        variables: {
          taskId,
        },
      });
    } catch (error) {
      this.postRunningFailedAction(error);
      throw error;
    }
  };

  retriggerTask = async () => {
    const taskId = nice();
    const task = omit(
      [...TASK_ADDED_FIELDS, 'dependencies'],
      removeKeys(cloneDeep(this.props.task), ['__typename'])
    );
    const now = Date.now();
    const created = Date.parse(task.created);

    Object.assign(task, {
      retries: 0,
      deadline: new Date(now + Date.parse(task.deadline) - created).toJSON(),
      expires: new Date(now + Date.parse(task.expires) - created).toJSON(),
      created: new Date(now).toJSON(),
    });

    this.preRunningAction();

    try {
      await this.props.client.mutate({
        mutation: createTaskQuery,
        variables: {
          taskId,
          task,
        },
      });

      return taskId;
    } catch (error) {
      this.postRunningFailedAction(error);
      throw error;
    }
  };

  renderActionIcon = action => {
    switch (action.name) {
      case 'retrigger': {
        return <RestartIcon />;
      }

      case 'create-interactive': {
        return <ConsoleLineIcon />;
      }

      case 'cancel': {
        return <CloseIcon />;
      }

      case 'rerun': {
        return <RestartIcon />;
      }

      case 'purge-caches': {
        return <CreationIcon />;
      }

      case 'backfill': {
        return <ShovelIcon />;
      }

      default: {
        return <HammerIcon />;
      }
    }
  };

  renderPurgeWorkerCacheDialogBody = selectedCaches => {
    const { caches } = this.state;

    return (
      <Fragment>
        <Typography variant="body2">
          This will purge caches used in this task across all workers of this
          worker type.
        </Typography>
        <Typography variant="body2">Select the caches to purge:</Typography>
        <List>
          {caches.map(cache => (
            <ListItem
              className={this.props.classes.dialogListItem}
              onClick={this.handleSelectCacheClick(cache)}
              key={cache}>
              <Checkbox
                checked={selectedCaches.has(cache)}
                tabIndex={-1}
                disableRipple
              />
              <Typography variant="body2">{cache}</Typography>
            </ListItem>
          ))}
        </List>
      </Fragment>
    );
  };

  render() {
    const { children } = this.props;
    const {
      dialogActionProps,
      actionData,
      taskActions,
      selectedAction,
      dialogOpen,
      actionInputs,
      actionLoading,
      dialogError,
      snackbar,
    } = this.state;

    return (
      <Fragment>
        <SpeedDial>
          {!('cancel' in actionData) && (
            <SpeedDialAction
              requiresAuth
              tooltipOpen
              FabProps={{
                disabled: actionLoading,
              }}
              icon={<CloseIcon />}
              tooltipTitle="Cancel"
              onClick={this.handleCancelTaskClick}
            />
          )}
          {!('retrigger' in actionData) && (
            <SpeedDialAction
              requiresAuth
              tooltipOpen
              FabProps={{
                disabled: actionLoading,
              }}
              icon={<RestartIcon />}
              tooltipTitle="Retrigger"
              onClick={this.handleRetriggerTaskClick}
            />
          )}
          {!('rerun' in actionData) && (
            <SpeedDialAction
              requiresAuth
              tooltipOpen
              FabProps={{
                disabled: actionLoading,
              }}
              icon={<RestartIcon />}
              tooltipTitle="Rerun"
              onClick={this.handleRerunTaskClick}
            />
          )}
          {!('schedule' in actionData) && (
            <SpeedDialAction
              requiresAuth
              tooltipOpen
              FabProps={{
                disabled: actionLoading,
              }}
              icon={<ClockOutlineIcon />}
              tooltipTitle="Schedule"
              onClick={this.handleScheduleTaskClick}
            />
          )}
          {!('purge-caches' in actionData) && (
            <SpeedDialAction
              requiresAuth
              tooltipOpen
              FabProps={{
                disabled: actionLoading,
              }}
              icon={<FlashIcon />}
              tooltipTitle="Purge Worker Cache"
              onClick={this.handlePurgeWorkerCacheClick}
            />
          )}
          <SpeedDialAction
            requiresAuth
            tooltipOpen
            FabProps={{
              disabled: actionLoading,
            }}
            icon={<PencilIcon />}
            tooltipTitle="Edit"
            onClick={this.handleEditTaskClick}
          />
          {!('create-interactive' in actionData) && (
            <SpeedDialAction
              requiresAuth
              tooltipOpen
              FabProps={{
                disabled: actionLoading,
              }}
              icon={<ConsoleLineIcon />}
              tooltipTitle="Create with SSH/VNC"
              onClick={this.handleCreateInteractiveTaskClick}
            />
          )}
          {children}
          {taskActions &&
            taskActions.length &&
            taskActions.map(action => (
              <SpeedDialAction
                requiresAuth
                tooltipOpen
                key={action.title}
                FabProps={{
                  disabled: actionLoading,
                }}
                icon={this.renderActionIcon(action)}
                tooltipTitle={action.title}
                onClick={this.handleActionClick(action.name)}
              />
            ))}
        </SpeedDial>
        {dialogOpen && (
          <DialogAction
            {...(dialogActionProps || {
              fullScreen: Boolean(selectedAction.schema),
              onSubmit: this.handleActionTaskSubmit(selectedAction),
              onComplete: this.handleActionComplete(selectedAction),
              title: `${selectedAction.title}?`,
              body: (
                <TaskActionForm
                  action={selectedAction}
                  form={actionInputs[selectedAction.name]}
                  onFormChange={this.handleFormChange}
                />
              ),
              confirmText: selectedAction.title,
            })}
            open={dialogOpen}
            error={dialogError}
            onError={this.handleTaskActionError}
            onClose={this.handleActionDialogClose}
          />
        )}
        <Snackbar onClose={this.handleSnackbarClose} {...snackbar} />
      </Fragment>
    );
  }
}