import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/db';

export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { name, description, groupImage, memberIds } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    // Create the group and add the creator as ADMIN
    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        groupImage: groupImage || null,
        createdBy: userId,
        members: {
          create: {
            userId,
            role: 'ADMIN'
          }
        }
      },
      include: {
        members: true
      }
    });

    // If initial members are provided, add them as MEMBERS
    if (memberIds && Array.isArray(memberIds)) {
      const additionalMembers = memberIds
        .filter((id: string) => id !== userId) // Skip creator
        .map((id: string) => ({
          groupId: group.id,
          userId: id,
          role: 'MEMBER' as const
        }));

      if (additionalMembers.length > 0) {
        await prisma.groupMember.createMany({
          data: additionalMembers,
          skipDuplicates: true
        });
      }
    }

    const fullGroup = await prisma.group.findUnique({
      where: { id: group.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                profilePhoto: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({ message: 'Group created successfully', group: fullGroup });
  } catch (error: any) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const inviteMember = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { groupId, targetUserId } = req.body;

    if (!userId || !groupId || !targetUserId) {
      return res.status(400).json({ error: 'Group ID and Target User ID are required' });
    }

    // Check if requester is an admin in the group
    const requesterMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId }
      }
    });

    if (!requesterMember || requesterMember.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only group admins can add new members' });
    }

    // Check if target user is already in the group
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: targetUserId }
      }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this group' });
    }

    // Add member
    const newMember = await prisma.groupMember.create({
      data: {
        groupId,
        userId: targetUserId,
        role: 'MEMBER'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            profilePhoto: true
          }
        }
      }
    });

    res.status(200).json({ message: 'Member added successfully', member: newMember });
  } catch (error: any) {
    console.error('Invite member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { groupId, targetUserId } = req.body;

    if (!userId || !groupId || !targetUserId) {
      return res.status(400).json({ error: 'Group ID and Target User ID are required' });
    }

    // Check if requester is an admin in the group
    const requesterMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId }
      }
    });

    if (!requesterMember || requesterMember.role !== 'ADMIN') {
      // Allow users to remove themselves (leave group)
      if (userId !== targetUserId) {
        return res.status(403).json({ error: 'Only group admins can remove members' });
      }
    }

    // Check if target user is in the group
    const targetMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: targetUserId }
      }
    });

    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found in group' });
    }

    // If admin is leaving, make sure they are not the last admin if there are other members
    if (targetMember.role === 'ADMIN' && userId === targetUserId) {
      const adminCount = await prisma.groupMember.count({
        where: { groupId, role: 'ADMIN' }
      });

      if (adminCount === 1) {
        const totalMembers = await prisma.groupMember.count({
          where: { groupId }
        });

        if (totalMembers > 1) {
          return res.status(400).json({ error: 'Please promote another member to Admin before leaving the group' });
        }
      }
    }

    // Remove member
    await prisma.groupMember.delete({
      where: {
        groupId_userId: { groupId, userId: targetUserId }
      }
    });

    // If no members are left, delete the group entirely
    const remainingCount = await prisma.groupMember.count({
      where: { groupId }
    });

    if (remainingCount === 0) {
      await prisma.group.delete({
        where: { id: groupId }
      });
    }

    res.status(200).json({ message: 'Member removed/left successfully' });
  } catch (error: any) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyGroups = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch all groups the user is member of
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                    profilePhoto: true,
                    publicKey: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const groups = memberships.map(m => m.group);
    res.status(200).json(groups);
  } catch (error: any) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
